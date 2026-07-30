/**
 * Backfills patient_packages.category and .purchased_at, both of which are
 * wrong for every row imported by the historical migration scripts:
 *   - category is NULL on 100% of rows (a 2026-07-28 code change made
 *     /target-progress read this column for Paket Klinik/Visit capaian, but
 *     nothing has ever written to it for existing rows).
 *   - purchased_at is stamped with whatever date the import script happened
 *     to run on (silently defaults to CURRENT_DATE), not the true purchase
 *     date, so every package appears to have been bought on that one day.
 *
 * Source of truth: patient_packages.notes often contains "kode:TRX/YYYY/MM/NNNN"
 * (the legacy transaction code). Cross-referencing that code against
 * orders_with_sessions.json / orders_paket.json recovers the real creation
 * date ("DIBUAT TGL") and service ("LAYANAN", which tells Klinik vs Visit)
 * with a 100% match rate for rows that have the code.
 *
 * For the remaining rows (no code, or code not found in the JSON), falls
 * back to the earliest linked patient_visits row (visit_date + service_type)
 * where one exists, and flags those as low-confidence in the summary. Rows
 * with neither signal are left untouched and listed for manual review.
 *
 * Only touches rows where category IS NULL — safe to rerun; won't clobber
 * a category someone has since set by hand via the app.
 *
 * Default is dry-run (prints what would happen). Pass --execute to write.
 *
 * Run with: npx tsx data_migrations/backfill-package-category-and-date.ts [--execute]
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// ── env ──────────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '../.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const EXECUTE = process.argv.includes('--execute')

type Category = 'PAKET KLINIK' | 'PAKET VISIT'

// ── legacy order lookup ─────────────────────────────────────────────────────
interface LegacyOrder {
  KODE: string
  LAYANAN: string
  'DIBUAT TGL': string
}

function parseDmyToIso(dmy: string): string | null {
  const [d, m, y] = dmy.split('-')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function loadJson<T>(file: string): T[] {
  const p = path.join(__dirname, file)
  if (!fs.existsSync(p)) return []
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

const kodeToOrder = new Map<string, LegacyOrder>()
for (const o of [...loadJson<LegacyOrder>('orders_with_sessions.json'), ...loadJson<LegacyOrder>('orders_paket.json')]) {
  if (o.KODE && !kodeToOrder.has(o.KODE)) kodeToOrder.set(o.KODE, o)
}
console.log(`Loaded ${kodeToOrder.size} distinct legacy orders (KODE) from JSON sources`)

function categoryFromLayanan(layanan: string): Category {
  return layanan.toUpperCase() === 'PAKET HOME VISIT' ? 'PAKET VISIT' : 'PAKET KLINIK'
}

function categoryFromServiceType(serviceType: string): Category | null {
  if (serviceType === 'PAKET TERAPI') return 'PAKET KLINIK'
  if (serviceType === 'PAKET VISIT') return 'PAKET VISIT'
  return null
}

// ── supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function fetchAllPages<T>(table: string, select: string): Promise<T[]> {
  const PAGE = 1000
  const out: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    out.push(...(data as T[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}

interface PackageRow {
  id: string
  package_name: string
  notes: string | null
  category: Category | null
  purchased_at: string
}
interface VisitRow {
  package_id: string | null
  visit_date: string
  service_type: string | null
}

async function main() {
  console.log(EXECUTE ? '\n*** EXECUTE MODE — will write to the database ***\n' : '\n*** DRY RUN — no writes will be made (pass --execute to write) ***\n')

  const packages = await fetchAllPages<PackageRow>('patient_packages', 'id, package_name, notes, category, purchased_at')
  console.log(`Loaded ${packages.length} patient_packages rows`)

  const visits = await fetchAllPages<VisitRow>('patient_visits', 'package_id, visit_date, service_type')
  const visitsByPackage = new Map<string, VisitRow[]>()
  for (const v of visits) {
    if (!v.package_id) continue
    const list = visitsByPackage.get(v.package_id) ?? []
    list.push(v)
    visitsByPackage.set(v.package_id, list)
  }

  const toUpdate: { id: string; category: Category; purchased_at: string; confidence: 'high' | 'low' }[] = []
  const needsReview: PackageRow[] = []

  for (const pkg of packages) {
    if (pkg.category) continue // already set (e.g. fixed by hand) — never touch

    const kodeMatch = pkg.notes?.match(/TRX\/\d{4}\/\d{2}\/\d+/)?.[0]
    const order = kodeMatch ? kodeToOrder.get(kodeMatch) : undefined

    if (order) {
      const iso = parseDmyToIso(order['DIBUAT TGL'])
      if (iso) {
        toUpdate.push({ id: pkg.id, category: categoryFromLayanan(order.LAYANAN), purchased_at: iso, confidence: 'high' })
        continue
      }
    }

    // Fallback: infer from earliest linked visit
    const linked = (visitsByPackage.get(pkg.id) ?? []).slice().sort((a, b) => a.visit_date.localeCompare(b.visit_date))
    const withCategory = linked.find(v => categoryFromServiceType(v.service_type ?? '') !== null)
    if (withCategory) {
      toUpdate.push({
        id: pkg.id,
        category: categoryFromServiceType(withCategory.service_type ?? '')!,
        purchased_at: linked[0].visit_date,
        confidence: 'low',
      })
      continue
    }

    needsReview.push(pkg)
  }

  const highConfidence = toUpdate.filter(u => u.confidence === 'high')
  const lowConfidence = toUpdate.filter(u => u.confidence === 'low')

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Plan:
  High-confidence (matched via legacy KODE):  ${highConfidence.length}
  Low-confidence (inferred from linked visit): ${lowConfidence.length}
  Needs manual review (no signal at all):      ${needsReview.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

  const catCounts = new Map<string, number>()
  const monthCounts = new Map<string, number>()
  for (const u of toUpdate) {
    catCounts.set(u.category, (catCounts.get(u.category) ?? 0) + 1)
    const month = u.purchased_at.slice(0, 7)
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1)
  }
  console.log('Resulting category distribution (post-backfill):')
  for (const [cat, n] of [...catCounts.entries()].sort()) console.log(`  ${cat}: ${n}`)
  console.log('\nResulting purchased_at distribution by month (post-backfill):')
  for (const [m, n] of [...monthCounts.entries()].sort()) console.log(`  ${m}: ${n}`)

  if (lowConfidence.length > 0) {
    console.log('\nLow-confidence rows (verify these after backfill, via Edit Paket):')
    for (const u of lowConfidence) {
      const pkg = packages.find(p => p.id === u.id)!
      console.log(`  ${u.id}  "${pkg.package_name}"  →  ${u.category} / ${u.purchased_at}`)
    }
  }

  if (needsReview.length > 0) {
    console.log('\nNeeds manual review (no KODE, no linked visit — left untouched):')
    for (const pkg of needsReview) {
      console.log(`  ${pkg.id}  "${pkg.package_name}"  notes=${pkg.notes ?? '(none)'}`)
    }
  }

  if (!EXECUTE) {
    console.log('\nDry run only — re-run with --execute to write these changes.')
    return
  }

  let ok = 0, failed = 0
  for (const u of toUpdate) {
    const { error } = await supabase
      .from('patient_packages')
      .update({ category: u.category, purchased_at: u.purchased_at })
      .eq('id', u.id)
    if (error) { console.error(`  FAIL ${u.id}: ${error.message}`); failed++ }
    else ok++
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Done.
  Updated: ${ok} (${failed} failed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
