/**
 * Backfill patient_visits for July 2026 (days 1-24 only — "today" excluded
 * since it's still in progress) from the freshly re-scraped orders_with_sessions.json.
 *
 * Unlike sync-all-sessions.ts / migrate-standalone-visits.ts (which DELETE + full
 * reimport), this is an UPSERT: it never deletes or overwrites data already
 * recorded in the app (jadwal harian, medical records). For each legacy session:
 *   - If a matching patient_visits row already exists (by package_id+visit_date,
 *     or patient_id+visit_date+shift), only fill kehadiran/attending_staff_id
 *     when they're currently NULL — never overwrite an already-set value.
 *   - Otherwise, insert a new row.
 *
 * Default is dry-run (prints what would happen). Pass --execute to write.
 *
 * Run with: npx tsx data_migrations/backfill-july-sync.ts [--execute]
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// ── env ──────────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '../.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ENCRYPTION_KEY   = process.env.ENCRYPTION_KEY!
if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ENCRYPTION_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY')
  process.exit(1)
}

const BRANCH_ID = 'cfe27e13-ba0b-440d-99f3-03e059efb877' // Fisioterapi Gang Sehat Pontianak
const SYNC_YEAR = 2026
const SYNC_MONTH = 7
const SYNC_MAX_DAY = 24 // "yesterday" — today (25) is still in progress

const EXECUTE = process.argv.includes('--execute')

// ── decryption ───────────────────────────────────────────────────────────────
const encKey = Buffer.from(ENCRYPTION_KEY, 'hex')
function isEncryptedFormat(text: string): boolean {
  const parts = text.split(':')
  if (parts.length !== 3) return false
  const hex = /^[0-9a-fA-F]+$/
  return parts[0].length === 32 && parts[1].length === 32 && hex.test(parts[0]) && hex.test(parts[1])
}
function decrypt(enc: string): string {
  if (!enc) return enc
  if (isEncryptedFormat(enc)) {
    try {
      const parts = enc.split(':')
      const d = crypto.createDecipheriv('aes-256-gcm', encKey, Buffer.from(parts[0], 'hex'))
      d.setAuthTag(Buffer.from(parts[1], 'hex'))
      let r = d.update(parts[2], 'hex', 'utf8')
      r += d.final('utf8')
      return r
    } catch { /* fall through */ }
  }
  return enc
}
function normName(s: string): string { return s.trim().toUpperCase() }

// ── source data ───────────────────────────────────────────────────────────────
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

const orders: Order[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'orders_with_sessions.json'), 'utf8'),
)
console.log(`Loaded ${orders.length} orders from orders_with_sessions.json`)

const orderByKode = new Map<string, Order>()
for (const o of orders) orderByKode.set(o.KODE, o)

const STATUS_MAP: Record<string, 'active' | 'completed'> = {
  Proses: 'active', Booking: 'active', Evaluasi: 'completed', Selesai: 'completed', Stop: 'completed',
}

const paketByPatient = new Map<string, Order[]>()
for (const o of orders) {
  if (!o.LAYANAN?.toUpperCase().startsWith('PAKET')) continue
  if (!STATUS_MAP[o.STATUS]) continue
  const name = normName(o.PASIEN)
  const list = paketByPatient.get(name) ?? []
  list.push(o)
  paketByPatient.set(name, list)
}

function parseDate(dmy: string): string | null {
  const [d, m, y] = dmy.split('-')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}
function parseToDate(dmy: string): Date | null {
  const iso = parseDate(dmy)
  return iso ? new Date(iso) : null
}
function daysBetween(a: Date, b: Date): number {
  return Math.abs((a.getTime() - b.getTime()) / 86_400_000)
}
function inSyncWindow(dmy: string): boolean {
  const iso = parseDate(dmy)
  if (!iso) return false
  const [y, m, d] = iso.split('-').map(Number)
  return y === SYNC_YEAR && m === SYNC_MONTH && d >= 1 && d <= SYNC_MAX_DAY
}
function deriveVisitServiceType(layanan: string): string {
  const u = layanan.toUpperCase()
  if (u.startsWith('PAKET')) return u.includes('VISIT') ? 'PAKET VISIT' : 'PAKET TERAPI'
  if (u === 'TERAPI AWAL') return 'TERAPI AWAL'
  if (u === 'TA VISIT')    return 'TA VISIT'
  if (u.includes('VISIT')) return 'SESI VISIT'
  return 'SESI TERAPI'
}
function deriveShift(jam: string): 'PAGI' | 'SORE' {
  if (!jam || jam === '-') return 'PAGI'
  const [h] = jam.split(':').map(Number)
  return h < 12 ? 'PAGI' : 'SORE'
}
// Preserves "unmarked" as null (unlike the older migration scripts' deriveKehadiran,
// which defaulted '-' to HADIR) — the app's isAttended() already treats a null
// kehadiran on a past date as attended, so we don't need to bake that assumption
// into the stored data itself.
function deriveKehadiran(statusSesi: string): 'HADIR' | 'TIDAK HADIR' | null {
  if (statusSesi === 'Hadir') return 'HADIR'
  if (statusSesi === 'Tidak Hadir') return 'TIDAK HADIR'
  return null
}
function matchTherapist(fisioName: string, profiles: { id: string; full_name: string }[]): string | null {
  if (!fisioName || fisioName === '-') return null
  const upper = fisioName.trim().toUpperCase()
  for (const p of profiles) {
    const words = p.full_name.toUpperCase().split(/\s+/)
    if (words.some(w => w === upper)) return p.id
  }
  for (const p of profiles) {
    const words = p.full_name.toUpperCase().split(/\s+/)
    if (words.some(w => w.startsWith(upper) && upper.length >= 3)) return p.id
  }
  return null
}

// ── supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function fetchAllPages<T>(
  table: string, select: string, apply?: (q: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<T[]> {
  const PAGE = 1000
  const out: T[] = []
  let from = 0
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + PAGE - 1)
    if (apply) q = apply(q)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    if (!data?.length) break
    out.push(...(data as T[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}

interface ExistingVisit {
  id: string
  patient_id: string
  visit_date: string
  shift: string | null
  package_id: string | null
  kehadiran: 'HADIR' | 'TIDAK HADIR' | null
  attending_staff_id: string | null
  status: string
}

async function main() {
  console.log(EXECUTE ? '\n*** EXECUTE MODE — will write to the database ***\n' : '\n*** DRY RUN — no writes will be made (pass --execute to write) ***\n')

  const profiles = await fetchAllPages<{ id: string; full_name: string }>('internal_profiles', 'id, full_name')
  console.log(`Loaded ${profiles.length} staff profiles`)

  const patientsRaw = await fetchAllPages<{ id: string; encrypted_name: string }>('patients', 'id, encrypted_name')
  const nameToId = new Map<string, string>()
  const idToName = new Map<string, string>()
  for (const p of patientsRaw) {
    const name = p.encrypted_name ? normName(decrypt(p.encrypted_name)) : ''
    if (name) { nameToId.set(name, p.id); idToName.set(p.id, name) }
  }
  console.log(`Loaded ${patientsRaw.length} patients (${nameToId.size} decrypted)`)

  const packages = await fetchAllPages<{
    id: string; patient_id: string; package_name: string; status: string
    notes: string | null; created_at: string
  }>('patient_packages', 'id, patient_id, package_name, status, notes, created_at', q => q.eq('branch_id', BRANCH_ID))
  console.log(`Loaded ${packages.length} packages for this branch`)

  const existingVisits = await fetchAllPages<ExistingVisit>(
    'patient_visits',
    'id, patient_id, visit_date, shift, package_id, kehadiran, attending_staff_id, status',
    q => q.eq('branch_id', BRANCH_ID)
      .gte('visit_date', `${SYNC_YEAR}-${String(SYNC_MONTH).padStart(2, '0')}-01`)
      .lte('visit_date', `${SYNC_YEAR}-${String(SYNC_MONTH).padStart(2, '0')}-${String(SYNC_MAX_DAY).padStart(2, '0')}`),
  )
  console.log(`Loaded ${existingVisits.length} existing patient_visits rows in the sync window`)

  const byPackageDate = new Map<string, ExistingVisit>()
  const byPatientDateShift = new Map<string, ExistingVisit>()
  for (const v of existingVisits) {
    if (v.package_id) byPackageDate.set(`${v.package_id}::${v.visit_date}`, v)
    byPatientDateShift.set(`${v.patient_id}::${v.visit_date}::${v.shift ?? ''}`, v)
  }

  // Match each package-order to an existing patient_package (KODE-exact, then fuzzy)
  function matchPackage(order: Order): { id: string; patient_id: string } | null {
    for (const pkg of packages) {
      if (pkg.notes?.startsWith('kode:') && pkg.notes.replace('kode:', '').trim() === order.KODE) return pkg
    }
    const candidates = packages.filter(pkg => {
      const patientName = idToName.get(pkg.patient_id)
      if (patientName !== normName(order.PASIEN)) return false
      const upperLayanan = order.LAYANAN.toUpperCase()
      const keyword = upperLayanan.replace('PAKET ', '')
      const upperPkgName = pkg.package_name.toUpperCase()
      return upperPkgName.includes(keyword) || upperPkgName.includes(upperLayanan)
    })
    if (candidates.length === 0) return null
    if (candidates.length === 1) return candidates[0]
    const orderCreated = order['DIBUAT TGL'] ? parseToDate(order['DIBUAT TGL']) : null
    return candidates.reduce((best, pkg) => {
      const pkgCreated = new Date(pkg.created_at)
      const dPkg = orderCreated ? daysBetween(orderCreated, pkgCreated) : Infinity
      const bestCreated = new Date(best.created_at)
      const dBest = orderCreated ? daysBetween(orderCreated, bestCreated) : Infinity
      return dPkg < dBest ? pkg : best
    })
  }

  let inserted = 0, updated = 0, unchanged = 0, skippedNoPatient = 0, skippedNoPackage = 0

  const insertRows: Record<string, unknown>[] = []
  const updates: { id: string; patch: Record<string, unknown> }[] = []

  for (const order of orders) {
    const isPaket = order.LAYANAN?.toUpperCase().startsWith('PAKET')
    const patientId = nameToId.get(normName(order.PASIEN))

    let matchedPkg: { id: string; patient_id: string } | null = null
    if (isPaket) {
      matchedPkg = matchPackage(order)
    }

    for (const s of order.sessions ?? []) {
      if (!inSyncWindow(s.TANGGAL)) continue
      const visitDate = parseDate(s.TANGGAL)!
      const kehadiran = deriveKehadiran(s.STATUS_SESI)
      const serviceType = deriveVisitServiceType(order.LAYANAN)
      const shift = deriveShift(s.JAM)
      const staffId = matchTherapist(s.FISIO, profiles)

      if (isPaket) {
        if (!matchedPkg) { skippedNoPackage++; continue }
        const key = `${matchedPkg.id}::${visitDate}`
        const existing = byPackageDate.get(key)
        if (existing) {
          const patch: Record<string, unknown> = {}
          if (existing.kehadiran === null && kehadiran !== null) {
            patch.kehadiran = kehadiran
            patch.status = 'completed'
          }
          if (existing.attending_staff_id === null && staffId) patch.attending_staff_id = staffId
          if (Object.keys(patch).length > 0) { updates.push({ id: existing.id, patch }); updated++ }
          else unchanged++
        } else {
          insertRows.push({
            patient_id: matchedPkg.patient_id, package_id: matchedPkg.id, branch_id: BRANCH_ID,
            visit_date: visitDate, visit_time: s.JAM && s.JAM !== '-' ? s.JAM : null, shift,
            service_type: serviceType, kehadiran, status: kehadiran ? 'completed' : 'scheduled',
            attending_staff_id: staffId,
          })
          byPackageDate.set(key, { id: '(pending)', patient_id: matchedPkg.patient_id, visit_date: visitDate, shift, package_id: matchedPkg.id, kehadiran, attending_staff_id: staffId, status: 'scheduled' })
          inserted++
        }
      } else {
        if (!patientId) { skippedNoPatient++; continue }
        const key = `${patientId}::${visitDate}::${shift}`
        const existing = byPatientDateShift.get(key)
        if (existing) {
          const patch: Record<string, unknown> = {}
          if (existing.kehadiran === null && kehadiran !== null) {
            patch.kehadiran = kehadiran
            patch.status = 'completed'
          }
          if (existing.attending_staff_id === null && staffId) patch.attending_staff_id = staffId
          if (Object.keys(patch).length > 0) { updates.push({ id: existing.id, patch }); updated++ }
          else unchanged++
        } else {
          insertRows.push({
            patient_id: patientId, package_id: null, branch_id: BRANCH_ID,
            visit_date: visitDate, visit_time: s.JAM && s.JAM !== '-' ? s.JAM : null, shift,
            service_type: serviceType, kehadiran, status: kehadiran ? 'completed' : 'scheduled',
            attending_staff_id: staffId,
          })
          byPatientDateShift.set(key, { id: '(pending)', patient_id: patientId, visit_date: visitDate, shift, package_id: null, kehadiran, attending_staff_id: staffId, status: 'scheduled' })
          inserted++
        }
      }
    }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Plan (July ${SYNC_MONTH}/1-${SYNC_MAX_DAY}, ${SYNC_YEAR}):
  Would insert:                 ${inserted}
  Would update (fill gaps):     ${updated}
  Already in sync:              ${unchanged}
  Skipped (no patient match):   ${skippedNoPatient}
  Skipped (no package match):   ${skippedNoPackage}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

  if (!EXECUTE) {
    console.log('Dry run only — re-run with --execute to write these changes.')
    return
  }

  let insertFailed = 0, updateFailed = 0
  const CHUNK = 500
  for (let i = 0; i < insertRows.length; i += CHUNK) {
    const chunk = insertRows.slice(i, i + CHUNK)
    const { error } = await supabase.from('patient_visits').insert(chunk)
    if (error) { console.error('Insert chunk failed:', error.message); insertFailed += chunk.length }
  }
  for (const u of updates) {
    const { error } = await supabase.from('patient_visits').update(u.patch).eq('id', u.id)
    if (error) { console.error(`Update failed for ${u.id}:`, error.message); updateFailed++ }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Done.
  Inserted: ${insertRows.length - insertFailed} (${insertFailed} failed)
  Updated:  ${updates.length - updateFailed} (${updateFailed} failed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
