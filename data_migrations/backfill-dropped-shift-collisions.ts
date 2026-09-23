/**
 * Backfill patient_visits rows dropped by the visit_date::shift dedup bug in
 * full-reset-reimport.ts.
 *
 * buildVisitRows() there deduped sessions on `${visitDate}::${shift}` where
 * shift is only 'PAGI' | 'SORE' (an AM/PM bucket) — so two real sessions on
 * the same date, both in the same half of the day (e.g. 19:00 and 20:00),
 * collapsed onto one key and the second was silently dropped.
 *
 * This script replays the same source data with a finer key
 * (`${visitDate}::${JAM ?? 'NULL'}`), compares against what's already in the
 * DB for each order's package (or, for non-PAKET orders, the patient's
 * standalone visits), and inserts whatever is genuinely missing.
 *
 * Defaults to DRY RUN (no writes). Pass --apply to actually insert.
 *
 * Run with:
 *   npx tsx data_migrations/backfill-dropped-shift-collisions.ts            # dry run
 *   npx tsx data_migrations/backfill-dropped-shift-collisions.ts --apply    # writes
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// ── env ──────────────────────────────────────────────────────────────────────
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

const BRANCH_ID = 'cfe27e13-ba0b-440d-99f3-03e059efb877'
const APPLY = process.argv.includes('--apply')

function normName(s: string): string { return s.trim().toUpperCase() }

// ── types ─────────────────────────────────────────────────────────────────────
interface Session {
  PERTEMUAN: string
  TANGGAL: string
  JAM: string
  FISIO: string
  STATUS_SESI: string
  'NOMINAL BAYAR': string
  KETERANGAN: string
}

interface Order {
  KODE: string
  PASIEN: string
  LAYANAN: string
  STATUS: string
  'DIBUAT TGL': string
  sessions: Session[]
}

// ── helpers (mirrors full-reset-reimport.ts) ───────────────────────────────────
function parseDate(dmy: string): string | null {
  if (!dmy) return null
  const [d, m, y] = dmy.split('-')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function deriveShift(jam: string): 'PAGI' | 'SORE' {
  if (!jam || jam === '-') return 'PAGI'
  const h = parseInt(jam.split(':')[0], 10)
  return h < 12 ? 'PAGI' : 'SORE'
}

function deriveKehadiran(statusSesi: string): 'HADIR' | 'TIDAK HADIR' {
  return statusSesi === 'Tidak Hadir' ? 'TIDAK HADIR' : 'HADIR'
}

function deriveVisitServiceType(layanan: string): string {
  const u = layanan.toUpperCase()
  if (u.startsWith('PAKET')) return u.includes('VISIT') ? 'PAKET VISIT' : 'PAKET TERAPI'
  if (u === 'TERAPI AWAL') return 'TERAPI AWAL'
  if (u === 'TA VISIT')    return 'TA VISIT'
  if (u.includes('VISIT')) return 'SESI VISIT'
  return 'SESI TERAPI'
}

function matchTherapist(
  fisioName: string,
  profiles: { id: string; full_name: string }[],
): string | null {
  if (!fisioName || fisioName === '-') return null
  const upper = fisioName.trim().toUpperCase()
  for (const p of profiles) {
    if (p.full_name.toUpperCase().split(/\s+/).some(w => w === upper)) return p.id
  }
  for (const p of profiles) {
    if (p.full_name.toUpperCase().split(/\s+/).some(w => w.startsWith(upper) && upper.length >= 3)) return p.id
  }
  return null
}

function doneSessions(sessions: Session[]): Session[] {
  return (sessions ?? []).filter(
    s => s['NOMINAL BAYAR'] === 'Sudah Ditangani'
      || s.STATUS_SESI === 'Hadir'
      || s.STATUS_SESI === 'Tidak Hadir'
  )
}

/**
 * Fine-grained key: exact date + exact time, normalized to HH:MM (falls back to 'NULL').
 * DB `visit_time` comes back as "HH:MM:SS"; JSON `JAM` is "HH:MM" — both are truncated to
 * HH:MM so the two sources compare equal.
 */
function exactKey(visitDate: string, jam: string): string {
  const j = jam && jam !== '-' ? jam.slice(0, 5) : 'NULL'
  return `${visitDate}::${j}`
}

function buildMissingRows(
  order: Order,
  patientId: string,
  packageId: string | null,
  existingKeys: Set<string>,
  profiles: { id: string; full_name: string }[],
): object[] {
  const plannedThisOrder = new Set<string>()
  const rows: object[] = []
  for (const s of doneSessions(order.sessions)) {
    const visitDate = parseDate(s.TANGGAL)
    if (!visitDate) continue
    const key = exactKey(visitDate, s.JAM)
    if (existingKeys.has(key)) continue        // already in DB
    if (plannedThisOrder.has(key)) continue     // exact duplicate within this order's JSON
    plannedThisOrder.add(key)

    const shift = deriveShift(s.JAM)
    const keterangan = s.KETERANGAN?.trim()
    const isPaymentNote = /^Rp/.test(keterangan ?? '')
    rows.push({
      patient_id:         patientId,
      package_id:         packageId,
      branch_id:          BRANCH_ID,
      visit_date:         visitDate,
      visit_time:         s.JAM && s.JAM !== '-' ? s.JAM : null,
      shift,
      service_type:       deriveVisitServiceType(order.LAYANAN),
      kehadiran:          deriveKehadiran(s.STATUS_SESI),
      status:             'completed',
      attending_staff_id: matchTherapist(s.FISIO, profiles),
      notes:              (!isPaymentNote && keterangan && keterangan !== '-') ? keterangan : null,
    })
  }
  return rows
}

// ── main ──────────────────────────────────────────────────────────────────────
const MIGRATION_DIR = __dirname
const orders: Order[] = JSON.parse(
  fs.readFileSync(path.join(MIGRATION_DIR, 'orders_with_sessions.json'), 'utf8')
)
console.log(`Loaded ${orders.length} orders`)
console.log(APPLY ? 'Mode: APPLY (will write to DB)' : 'Mode: DRY RUN (no writes — pass --apply to write)')

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  const { data: profilesData } = await supabase.from('internal_profiles').select('id, full_name')
  const profiles = profilesData ?? []
  console.log(`Loaded ${profiles.length} staff profiles`)

  const PAGE = 1000
  let from = 0

  console.log('\nFetching all patient_packages (id, patient_id, notes)...')
  const allPackages: { id: string; patient_id: string; notes: string | null }[] = []
  from = 0
  while (true) {
    const { data, error } = await supabase.from('patient_packages')
      .select('id, patient_id, notes').range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    allPackages.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  const kodeToPackage = new Map<string, { id: string; patient_id: string }>()
  for (const p of allPackages) {
    const m = p.notes?.match(/kode:(\S+)/)
    if (m) kodeToPackage.set(m[1], { id: p.id, patient_id: p.patient_id })
  }
  console.log(`  ${allPackages.length} packages, ${kodeToPackage.size} with a matching kode: note`)

  console.log('\nFetching all patient_visits (id, patient_id, package_id, visit_date, visit_time)...')
  const allVisits: { patient_id: string; package_id: string | null; visit_date: string; visit_time: string | null }[] = []
  from = 0
  while (true) {
    const { data, error } = await supabase.from('patient_visits')
      .select('patient_id, package_id, visit_date, visit_time').range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    allVisits.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`  ${allVisits.length} existing visits loaded`)

  // Existing key set per package_id — this script only backfills PAKET (package-linked) visits.
  const existingByPackage = new Map<string, Set<string>>()
  for (const v of allVisits) {
    if (!v.package_id) continue
    const key = exactKey(v.visit_date, v.visit_time ?? '-')
    if (!existingByPackage.has(v.package_id)) existingByPackage.set(v.package_id, new Set())
    existingByPackage.get(v.package_id)!.add(key)
  }

  console.log('\n── Replaying PAKET orders to find dropped sessions ──')
  let paketMissingOrders = 0
  let paketMissingRows = 0
  let skippedNoPackageMatch = 0

  const toInsert: object[] = []
  const report: { kode: string; pasien: string; layanan: string; missing: number }[] = []

  for (const order of orders) {
    if (!order.LAYANAN?.toUpperCase().startsWith('PAKET')) continue

    const pkg = kodeToPackage.get(order.KODE)
    if (!pkg) { skippedNoPackageMatch++; continue }

    const existingKeys = existingByPackage.get(pkg.id) ?? new Set<string>()
    const missing = buildMissingRows(order, pkg.patient_id, pkg.id, existingKeys, profiles)
    if (missing.length > 0) {
      paketMissingOrders++
      paketMissingRows += missing.length
      toInsert.push(...missing)
      report.push({ kode: order.KODE, pasien: order.PASIEN, layanan: order.LAYANAN, missing: missing.length })
    }
  }

  console.log(`
── Replay summary ──
PAKET orders with dropped sessions found:   ${paketMissingOrders}
PAKET missing session rows to insert:       ${paketMissingRows}
PAKET orders skipped (no matching package): ${skippedNoPackageMatch}
(Standalone/non-PAKET orders: not processed in this pass — see script comment)
`)

  console.log('── Per-order detail ──')
  for (const r of report) {
    console.log(`  ${r.kode}  ${r.pasien.padEnd(30)} ${r.layanan.padEnd(12)} +${r.missing}`)
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — no writes performed. ${toInsert.length} rows would be inserted.`)
    console.log('Re-run with --apply to write these rows.')
    return
  }

  console.log(`\nInserting ${toInsert.length} rows...`)
  const CHUNK = 500
  let inserted = 0
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK)
    const { error } = await supabase.from('patient_visits').insert(chunk)
    if (error) {
      console.error(`  FAIL chunk starting at ${i}: ${error.message}`)
      continue
    }
    inserted += chunk.length
  }
  console.log(`\nDone. Inserted ${inserted} / ${toInsert.length} rows.`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
