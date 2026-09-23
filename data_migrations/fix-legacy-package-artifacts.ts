/**
 * Repairs two artifacts left by the original 2026-07-16 full-reset-reimport run.
 *
 * Phase 1 — stale visit rows.
 *   That run wrote some patient_visits with a time that matches no session in the
 *   source export (the export was corrected after the run; the DB never re-synced).
 *   backfill-dropped-shift-collisions.ts later inserted the correct row, leaving the
 *   wrong-time row behind as a duplicate — which is what pushes a package past its
 *   session count ("-1 sesi tersisa"). Deletes only rows that are ALL of:
 *     - linked to a package whose `kode:` note maps to a source order,
 *     - created in the 2026-07-16 batch (never a live app entry),
 *     - matching no session in that order, and
 *     - in a package that holds more rows than the order has attended sessions.
 *   A transaction pointing at a deleted row is repointed to the correct row for the
 *   same date when one exists, otherwise unlinked.
 *
 * Phase 2 — package status.
 *   deriveStatus() in that run never emitted 'stopped', so every legacy order with
 *   STATUS "Stop" imported as 'completed' and reads as "Selesai" in the UI. Sets
 *   those to 'stopped'. Only touches packages still sitting at exactly 'completed',
 *   so statuses staff have since changed in-app are left alone.
 *
 * Defaults to DRY RUN. Pass --apply to write.
 *
 *   npx tsx data_migrations/fix-legacy-package-artifacts.ts            # dry run
 *   npx tsx data_migrations/fix-legacy-package-artifacts.ts --apply    # writes
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

for (const envFile of ['../.env', '../.env.local']) {
  const envPath = path.join(__dirname, envFile)
  if (!fs.existsSync(envPath)) continue
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')

// full-reset-reimport.ts inserted its 5,915 rows between 00:41:59 and ~00:45 UTC on
// 2026-07-16. Staff were using the app the same day from 02:28 onwards, so matching on
// the date alone would sweep up real visits — the window has to be the batch itself.
const BATCH_START = Date.parse('2026-07-16T00:00:00Z')
const BATCH_END   = Date.parse('2026-07-16T01:00:00Z')
function isMigrationBatchRow(createdAt: string): boolean {
  const t = Date.parse(createdAt)
  return t >= BATCH_START && t < BATCH_END
}

interface Session { PERTEMUAN: string; TANGGAL: string; JAM: string; STATUS_SESI: string; 'NOMINAL BAYAR': string }
interface Order { KODE: string; PASIEN: string; LAYANAN: string; STATUS: string; sessions: Session[] }

function parseDate(dmy: string): string | null {
  if (!dmy) return null
  const [d, m, y] = dmy.split('-')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function doneSessions(sessions: Session[]): Session[] {
  return (sessions ?? []).filter(
    s => s['NOMINAL BAYAR'] === 'Sudah Ditangani' || s.STATUS_SESI === 'Hadir' || s.STATUS_SESI === 'Tidak Hadir'
  )
}

/** DB `visit_time` is "HH:MM:SS", source `JAM` is "HH:MM" — both truncated so they compare equal. */
function sessionKey(visitDate: string, jam: string | null): string {
  const j = jam && jam !== '-' ? jam.slice(0, 5) : 'NULL'
  return `${visitDate}::${j}`
}

const orders: Order[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'orders_with_sessions.json'), 'utf8'))
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const PAGE = 1000
  const rows: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    rows.push(...(data as T[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return rows
}

async function main() {
  console.log(`Loaded ${orders.length} orders`)
  console.log(APPLY ? 'Mode: APPLY (will write to DB)' : 'Mode: DRY RUN (no writes — pass --apply to write)')

  const packages = await fetchAll<{ id: string; notes: string | null; status: string }>(
    'patient_packages', 'id, notes, status')
  const visits = await fetchAll<{ id: string; package_id: string | null; visit_date: string; visit_time: string | null; created_at: string }>(
    'patient_visits', 'id, package_id, visit_date, visit_time, created_at')

  const pkgByKode = new Map<string, { id: string; status: string }>()
  for (const p of packages) {
    const m = p.notes?.match(/kode:(\S+)/)
    if (m) pkgByKode.set(m[1], { id: p.id, status: p.status })
  }
  const visitsByPkg = new Map<string, typeof visits>()
  for (const v of visits) {
    if (!v.package_id) continue
    if (!visitsByPkg.has(v.package_id)) visitsByPkg.set(v.package_id, [])
    visitsByPkg.get(v.package_id)!.push(v)
  }
  console.log(`${packages.length} packages (${pkgByKode.size} with a kode: note), ${visits.length} visits`)

  // ── Phase 1: stale visit rows ───────────────────────────────────────────────
  const staleRows: { kode: string; pasien: string; row: typeof visits[number]; replacementId: string | null }[] = []

  for (const order of orders) {
    if (!order.LAYANAN?.toUpperCase().startsWith('PAKET')) continue
    const pkg = pkgByKode.get(order.KODE)
    if (!pkg) continue

    const attended = doneSessions(order.sessions)
    const sourceKeys = new Set<string>()
    for (const s of attended) {
      const d = parseDate(s.TANGGAL)
      if (d) sourceKeys.add(sessionKey(d, s.JAM))
    }

    const rows = visitsByPkg.get(pkg.id) ?? []
    // Guard: never trim a package that isn't holding more rows than the order accounts for.
    if (rows.length <= attended.length) continue

    for (const row of rows) {
      if (!isMigrationBatchRow(row.created_at)) continue
      if (sourceKeys.has(sessionKey(row.visit_date, row.visit_time))) continue
      // The correct row for the same date, if the collision backfill supplied one.
      const replacement = rows.find(r =>
        r.id !== row.id &&
        r.visit_date === row.visit_date &&
        sourceKeys.has(sessionKey(r.visit_date, r.visit_time))
      )
      staleRows.push({ kode: order.KODE, pasien: order.PASIEN, row, replacementId: replacement?.id ?? null })
    }
  }

  console.log(`\n── Phase 1: stale visit rows ──`)
  console.log(`${staleRows.length} rows to delete, across ${new Set(staleRows.map(s => s.kode)).size} packages`)
  for (const s of staleRows) {
    console.log(`  ${s.kode}  ${s.pasien.slice(0, 26).padEnd(26)} ${s.row.visit_date} ${s.row.visit_time}  ${s.replacementId ? '(same-date replacement present)' : '(no same-date replacement)'}`)
  }

  const staleIds = staleRows.map(s => s.row.id)
  const linkedTx = staleIds.length
    ? await supabase.from('transactions').select('id, visit_id, amount, category').in('visit_id', staleIds)
    : { data: [], error: null }
  if (linkedTx.error) throw new Error(`transactions: ${linkedTx.error.message}`)
  console.log(`\n${linkedTx.data?.length ?? 0} transaction(s) reference a stale row:`)
  for (const t of linkedTx.data ?? []) {
    const s = staleRows.find(x => x.row.id === t.visit_id)!
    console.log(`  tx ${t.id} (${t.category}, ${t.amount}) → ${s.replacementId ? `repoint to ${s.replacementId}` : 'unlink (visit_id = null)'}`)
  }

  // ── Phase 2: package status ─────────────────────────────────────────────────
  const statusFixes: { kode: string; pasien: string; pkgId: string }[] = []
  for (const order of orders) {
    if (!order.LAYANAN?.toUpperCase().startsWith('PAKET')) continue
    if (order.STATUS !== 'Stop') continue
    const pkg = pkgByKode.get(order.KODE)
    // Only packages still at the value the buggy import wrote — never override a staff change.
    if (!pkg || pkg.status !== 'completed') continue
    statusFixes.push({ kode: order.KODE, pasien: order.PASIEN, pkgId: pkg.id })
  }
  console.log(`\n── Phase 2: package status ──`)
  console.log(`${statusFixes.length} packages: legacy STATUS "Stop" but stored as 'completed' → set to 'stopped'`)

  if (!APPLY) {
    console.log(`\nDRY RUN — no writes performed.`)
    console.log(`  would delete ${staleIds.length} visit rows`)
    console.log(`  would update ${linkedTx.data?.length ?? 0} transactions`)
    console.log(`  would update ${statusFixes.length} package statuses`)
    console.log('Re-run with --apply to write.')
    return
  }

  // Repoint or unlink referencing transactions first — patient_visits has an FK from transactions.
  for (const t of linkedTx.data ?? []) {
    const s = staleRows.find(x => x.row.id === t.visit_id)!
    const { error } = await supabase.from('transactions')
      .update({ visit_id: s.replacementId }).eq('id', t.id)
    if (error) { console.error(`  FAIL tx ${t.id}: ${error.message}`); return }
  }
  console.log(`\nUpdated ${linkedTx.data?.length ?? 0} transactions.`)

  const { data: deleted, error: delErr } = await supabase.from('patient_visits')
    .delete().in('id', staleIds).select('id')
  if (delErr) { console.error(`  FAIL delete: ${delErr.message}`); return }
  console.log(`Deleted ${deleted?.length} / ${staleIds.length} stale visit rows.`)

  let statusUpdated = 0
  for (let i = 0; i < statusFixes.length; i += 200) {
    const chunk = statusFixes.slice(i, i + 200)
    const { data, error } = await supabase.from('patient_packages')
      .update({ status: 'stopped', updated_at: new Date().toISOString() })
      .in('id', chunk.map(c => c.pkgId))
      .eq('status', 'completed')
      .select('id')
    if (error) { console.error(`  FAIL status chunk ${i}: ${error.message}`); return }
    statusUpdated += data?.length ?? 0
  }
  console.log(`Updated ${statusUpdated} / ${statusFixes.length} package statuses to 'stopped'.`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
