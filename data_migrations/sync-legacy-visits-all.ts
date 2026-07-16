/**
 * Phase 3 migration: import legacy sessions for packages where legacy_used_sessions > 0
 * but sessions haven't been imported yet (either no KODE in notes, or KODE has no sessions
 * in medical_records — the previous sync-package-sessions.ts matched a different order).
 *
 * Strategy:
 *   - For each package with legacy_used_sessions > 0:
 *     1. Decrypt patient name
 *     2. Match to old-system order by name + package keyword + date proximity
 *     3. Count "Sudah Ditangani" sessions for that KODE from medical_records
 *     4. Insert as patient_visits (batch per package)
 *     5. Set legacy_used_sessions = 0 (view now counts real visits)
 *
 * Idempotent: skips packages where legacy_used_sessions = 0 (already done).
 *
 * Run with:
 *   npx tsx data_migrations/sync-legacy-visits-all.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// ── env ────────────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '../.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ENCRYPTION_KEY) {
  console.error('Missing required env vars')
  process.exit(1)
}

const BRANCH_ID = 'cfe27e13-ba0b-440d-99f3-03e059efb877'

// ── decryption ─────────────────────────────────────────────────────────────────
const ALGORITHM = 'aes-256-gcm'
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
      const decipher = crypto.createDecipheriv(ALGORITHM, encKey, Buffer.from(parts[0], 'hex'))
      decipher.setAuthTag(Buffer.from(parts[1], 'hex'))
      let d = decipher.update(parts[2], 'hex', 'utf8')
      d += decipher.final('utf8')
      return d
    } catch { /* fall through */ }
  }
  const b64 = /^[A-Za-z0-9+/]+=*$/
  if (enc.length >= 4 && b64.test(enc)) {
    try {
      const decoded = Buffer.from(enc, 'base64').toString('utf8')
      const printable = decoded.replace(/[^\x20-\x7E -￿]/g, '')
      if (printable.length >= decoded.length * 0.8) return decoded
    } catch { /* fall through */ }
  }
  return enc
}

function normalizeName(name: string): string {
  return name.trim().toUpperCase()
}

// ── helpers ────────────────────────────────────────────────────────────────────
function parseIndonesianDate(dmy: string): string | null {
  const [d, m, y] = dmy.split('-')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function parseIndonesianDateAsDate(dmy: string): Date | null {
  const iso = parseIndonesianDate(dmy)
  return iso ? new Date(iso) : null
}

function deriveShift(jam: string): 'PAGI' | 'SORE' {
  if (!jam || jam === '-') return 'PAGI'
  const [h] = jam.split(':').map(Number)
  return h < 12 ? 'PAGI' : 'SORE'
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs((a.getTime() - b.getTime()) / 86_400_000)
}

function matchTherapist(
  fisioName: string,
  profiles: { id: string; full_name: string }[],
): string | null {
  if (!fisioName || fisioName === '-') return null
  const upper = fisioName.trim().toUpperCase()
  for (const p of profiles) {
    const words = p.full_name.toUpperCase().split(/\s+/)
    if (words.some((w) => w === upper)) return p.id
  }
  for (const p of profiles) {
    const words = p.full_name.toUpperCase().split(/\s+/)
    if (words.some((w) => w.startsWith(upper) && upper.length >= 3)) return p.id
  }
  return null
}

// ── load source data ───────────────────────────────────────────────────────────
interface MedicalRecord {
  KODE: string
  SESSION_TANGGAL: string
  SESSION_JAM: string
  SESSION_FISIO: string
  SESSION_STATUS: string
  SESSION_KETERANGAN: string
}

interface FisioRecord {
  KODE: string
  PASIEN: string
  LAYANAN: string
  STATUS: string
  'DIBUAT TGL': string
}

const MIGRATION_DIR = __dirname

const medicalRaw: MedicalRecord[] = JSON.parse(
  fs.readFileSync(path.join(MIGRATION_DIR, 'orders_medical_records.json'), 'utf8')
)
const fisioRaw: FisioRecord[] = JSON.parse(
  fs.readFileSync(path.join(MIGRATION_DIR, 'orders_fisiotherapy.json'), 'utf8')
)

// Sessions per KODE (only Sudah Ditangani)
const sessionsByKode = new Map<string, MedicalRecord[]>()
for (const r of medicalRaw) {
  if (r.SESSION_STATUS !== 'Sudah Ditangani') continue
  const list = sessionsByKode.get(r.KODE) ?? []
  list.push(r)
  sessionsByKode.set(r.KODE, list)
}

// PAKET orders from fisiotherapy (non-Batal), grouped by patient name
const STATUS_MAP: Record<string, string> = {
  Proses: 'active', Booking: 'active', Evaluasi: 'completed', Selesai: 'completed',
}

interface Order {
  kode: string
  pasien: string
  layanan: string
  status: string
  dibuatTgl: Date | null
  sessionsDone: number
}

const paketOrders: Order[] = []
for (const f of fisioRaw) {
  const layanan = (f.LAYANAN || '').trim()
  if (!layanan.toUpperCase().startsWith('PAKET')) continue
  const mappedStatus = STATUS_MAP[f.STATUS]
  if (!mappedStatus) continue
  paketOrders.push({
    kode: f.KODE,
    pasien: normalizeName(f.PASIEN),
    layanan,
    status: mappedStatus,
    dibuatTgl: f['DIBUAT TGL'] ? parseIndonesianDateAsDate(f['DIBUAT TGL']) : null,
    sessionsDone: sessionsByKode.get(f.KODE)?.length ?? 0,
  })
}

// Group orders by patient name for fast lookup
const ordersByPatient = new Map<string, Order[]>()
for (const o of paketOrders) {
  const list = ordersByPatient.get(o.pasien) ?? []
  list.push(o)
  ordersByPatient.set(o.pasien, list)
}

console.log(`Loaded ${paketOrders.length} PAKET orders, ${sessionsByKode.size} KODEs with sessions`)

// ── supabase ───────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
  // 1. Fetch all patients and decrypt names
  console.log('\nFetching patients...')
  const allPatients: { id: string; encrypted_name: string }[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('patients').select('id, encrypted_name').range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    allPatients.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  const nameToId = new Map<string, string>()
  const idToName = new Map<string, string>()
  for (const p of allPatients) {
    const name = p.encrypted_name ? normalizeName(decrypt(p.encrypted_name)) : ''
    if (name) { nameToId.set(name, p.id); idToName.set(p.id, name) }
  }
  console.log(`  ${allPatients.length} patients, ${nameToId.size} decrypted`)

  // 2. Fetch packages with legacy_used_sessions > 0
  console.log('\nFetching remaining packages...')
  const pendingPackages: {
    id: string; patient_id: string; package_name: string
    total_sessions: number; legacy_used_sessions: number; created_at: string
  }[] = []
  let pkgFrom = 0
  while (true) {
    const { data, error } = await supabase
      .from('patient_packages')
      .select('id, patient_id, package_name, total_sessions, legacy_used_sessions, created_at')
      .gt('legacy_used_sessions', 0)
      .range(pkgFrom, pkgFrom + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    pendingPackages.push(...data)
    if (data.length < PAGE) break
    pkgFrom += PAGE
  }
  console.log(`  ${pendingPackages.length} packages with legacy_used_sessions > 0`)

  // 3. Fetch internal_profiles for therapist matching
  const { data: profilesData } = await supabase.from('internal_profiles').select('id, full_name')
  const profiles = profilesData ?? []

  // 4. Process each pending package
  let inserted = 0
  let noMatch = 0
  let noSessions = 0
  let failed = 0

  for (const pkg of pendingPackages) {
    const patientName = idToName.get(pkg.patient_id)
    if (!patientName) {
      noMatch++
      console.log(`  SKIP ${pkg.id}: patient name not found`)
      continue
    }

    const upperPkgName = pkg.package_name.toUpperCase()
    const pkgCreated = new Date(pkg.created_at)

    // Find matching orders for this patient + package type
    const candidates = (ordersByPatient.get(patientName) ?? []).filter((o) => {
      const upperLayanan = o.layanan.toUpperCase()
      const keyword = upperLayanan.replace('PAKET ', '')
      return upperPkgName.includes(keyword) || upperPkgName.includes(upperLayanan)
    })

    if (candidates.length === 0) {
      noMatch++
      continue
    }

    // Pick closest date match to package created_at, and prefer orders with sessions
    const withSessions = candidates.filter((o) => o.sessionsDone > 0)
    const pool = withSessions.length > 0 ? withSessions : candidates

    let best = pool[0]
    if (pool.length > 1) {
      best = pool.reduce((closest, o) => {
        const refDate = o.dibuatTgl ?? pkgCreated
        const dClosest = daysBetween(new Date(closest.dibuatTgl ?? pkgCreated), refDate)
        const dO = daysBetween(pkgCreated, o.dibuatTgl ?? pkgCreated)
        const dClosestToCreated = daysBetween(pkgCreated, closest.dibuatTgl ?? pkgCreated)
        return dO < dClosestToCreated ? o : closest
      })
    }

    const sessions = sessionsByKode.get(best.kode)
    if (!sessions?.length) {
      noSessions++
      continue
    }

    // Build visit rows
    const rows = sessions.map((s) => {
      const keterangan = s.SESSION_KETERANGAN?.trim()
      return {
        patient_id:         pkg.patient_id,
        package_id:         pkg.id,
        branch_id:          BRANCH_ID,
        visit_date:         parseIndonesianDate(s.SESSION_TANGGAL),
        visit_time:         s.SESSION_JAM && s.SESSION_JAM !== '-' ? s.SESSION_JAM : null,
        shift:              deriveShift(s.SESSION_JAM),
        service_type:       'SESI TERAPI',
        kehadiran:          'HADIR',
        status:             'completed',
        attending_staff_id: matchTherapist(s.SESSION_FISIO, profiles),
        notes:              keterangan && keterangan !== '-' ? keterangan : null,
      }
    })

    const { error: insertErr } = await supabase.from('patient_visits').insert(rows)
    if (insertErr) {
      console.error(`  FAIL ${pkg.id} (${patientName} / ${pkg.package_name}): ${insertErr.message}`)
      failed++
      continue
    }

    // Reset legacy_used_sessions to 0
    await supabase.from('patient_packages')
      .update({ legacy_used_sessions: 0 })
      .eq('id', pkg.id)

    console.log(`  OK ${best.kode} → ${patientName} / ${pkg.package_name}: ${rows.length} visits`)
    inserted += rows.length
  }

  console.log(`
Done.
  Total pending packages:     ${pendingPackages.length}
  Sessions inserted:          ${inserted}
  No matching order found:    ${noMatch}
  Matched but 0 sessions done: ${noSessions}
  Failures:                   ${failed}
`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
