/**
 * Imports completed non-PAKET orders (TERAPI AWAL, SESI, SESI NEW, TA VISIT)
 * as bare patient_visits WITHOUT package_id.
 *
 * These were never imported because import-active-packages.mts only handled
 * active (Proses/Booking) orders; completed SESI/TA orders had no migration path.
 *
 * Skips KODEs already present in patient_packages.notes (those already have
 * package-linked visits from sync-all-sessions.ts).
 *
 * Run with: npx tsx data_migrations/migrate-standalone-visits.ts
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

const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!
if (!SUPABASE_URL || !SERVICE_KEY || !ENCRYPTION_KEY) {
  console.error('Missing env vars'); process.exit(1)
}

const BRANCH_ID = 'cfe27e13-ba0b-440d-99f3-03e059efb877'

// ── decryption ───────────────────────────────────────────────────────────────
const encKey = Buffer.from(ENCRYPTION_KEY, 'hex')

function decrypt(enc: string): string {
  if (!enc) return enc
  const parts = enc.split(':')
  if (parts.length !== 3) return enc
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', encKey, Buffer.from(parts[0], 'hex'))
    d.setAuthTag(Buffer.from(parts[1], 'hex'))
    let r = d.update(parts[2], 'hex', 'utf8')
    r += d.final('utf8')
    return r
  } catch { return enc }
}

function normName(s: string): string { return s.trim().toUpperCase() }

// ── helpers ───────────────────────────────────────────────────────────────────
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

function parseDate(dmy: string): string | null {
  const [d, m, y] = dmy.split('-')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function deriveShift(jam: string): 'PAGI' | 'SORE' {
  if (!jam || jam === '-') return 'PAGI'
  const [h] = jam.split(':').map(Number)
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
    const words = p.full_name.toUpperCase().split(/\s+/)
    if (words.some(w => w === upper)) return p.id
  }
  for (const p of profiles) {
    const words = p.full_name.toUpperCase().split(/\s+/)
    if (words.some(w => w.startsWith(upper) && upper.length >= 3)) return p.id
  }
  return null
}

// ── load source data ──────────────────────────────────────────────────────────
const MIGRATION_DIR = __dirname
const orders: Order[] = JSON.parse(
  fs.readFileSync(path.join(MIGRATION_DIR, 'orders_with_sessions.json'), 'utf8')
)

// Only non-PAKET orders, non-Batal
const standaloneOrders = orders.filter(o =>
  !o.LAYANAN?.toUpperCase().startsWith('PAKET') &&
  o.STATUS !== 'Batal'
)
console.log(`Loaded ${orders.length} total orders → ${standaloneOrders.length} non-PAKET non-Batal orders`)

// ── supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  const PAGE = 1000

  // Load staff profiles
  const { data: profilesData } = await supabase.from('internal_profiles').select('id, full_name')
  const profiles = profilesData ?? []
  console.log(`Loaded ${profiles.length} staff profiles`)

  // Load patients (paginated) → name → id map
  console.log('\nFetching patients...')
  const allPatients: { id: string; encrypted_name: string }[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from('patients')
      .select('id, encrypted_name').range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    allPatients.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  const nameToId = new Map<string, string>()
  for (const p of allPatients) {
    const name = p.encrypted_name ? normName(decrypt(p.encrypted_name)) : ''
    if (name) nameToId.set(name, p.id)
  }
  console.log(`  ${allPatients.length} patients, ${nameToId.size} decrypted`)

  // Load already-imported KODEs from patient_packages.notes
  console.log('\nFetching imported KODEs from patient_packages...')
  const importedKodes = new Set<string>()
  let pkgFrom = 0
  while (true) {
    const { data, error } = await supabase.from('patient_packages')
      .select('notes').range(pkgFrom, pkgFrom + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    for (const p of data) {
      if (p.notes?.startsWith('kode:')) importedKodes.add(p.notes.replace('kode:', '').trim())
    }
    if (data.length < PAGE) break
    pkgFrom += PAGE
  }
  console.log(`  ${importedKodes.size} KODEs already imported`)

  // Load existing standalone visits for de-dup check: (patient_id, visit_date, shift) where package_id IS NULL
  console.log('\nFetching existing standalone visits...')
  const existingKeys = new Set<string>()
  let visitFrom = 0
  while (true) {
    const { data, error } = await supabase.from('patient_visits')
      .select('patient_id, visit_date, shift')
      .is('package_id', null)
      .range(visitFrom, visitFrom + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    for (const v of data) {
      existingKeys.add(`${v.patient_id}::${v.visit_date}::${v.shift ?? ''}`)
    }
    if (data.length < PAGE) break
    visitFrom += PAGE
  }
  console.log(`  ${existingKeys.size} existing standalone visits`)

  let inserted = 0
  let skippedKode = 0
  let skippedNoPatient = 0
  let skippedNoSessions = 0
  let skippedDup = 0
  let failed = 0

  for (const order of standaloneOrders) {
    // Skip already-imported KODEs
    if (importedKodes.has(order.KODE)) { skippedKode++; continue }

    // Match patient
    const patId = nameToId.get(normName(order.PASIEN))
    if (!patId) { skippedNoPatient++; continue }

    // Filter done sessions
    const doneSessions = order.sessions?.filter(
      s => s['NOMINAL BAYAR'] === 'Sudah Ditangani'
        || s.STATUS_SESI === 'Hadir'
        || s.STATUS_SESI === 'Tidak Hadir'
    ) ?? []

    if (doneSessions.length === 0) { skippedNoSessions++; continue }

    const serviceType = deriveVisitServiceType(order.LAYANAN)

    const rows = []
    for (const s of doneSessions) {
      const visitDate = parseDate(s.TANGGAL)
      if (!visitDate) continue
      const shift = deriveShift(s.JAM)
      const key = `${patId}::${visitDate}::${shift}`
      if (existingKeys.has(key)) { skippedDup++; continue }
      existingKeys.add(key) // mark to avoid intra-batch duplication

      const keterangan = s.KETERANGAN?.trim()
      const isPaymentNote = /^Rp/.test(keterangan ?? '')

      rows.push({
        patient_id:         patId,
        package_id:         null,
        branch_id:          BRANCH_ID,
        visit_date:         visitDate,
        shift,
        service_type:       serviceType,
        kehadiran:          deriveKehadiran(s.STATUS_SESI),
        status:             'completed',
        attending_staff_id: matchTherapist(s.FISIO, profiles),
        notes:              (!isPaymentNote && keterangan && keterangan !== '-') ? keterangan : null,
      })
    }

    if (rows.length === 0) { skippedNoSessions++; continue }

    const { error } = await supabase.from('patient_visits').insert(rows)
    if (error) {
      console.error(`  FAIL ${order.KODE} → ${order.PASIEN}: ${error.message}`)
      failed++
      continue
    }

    inserted += rows.length
    console.log(`  OK ${order.KODE} (${order.LAYANAN}) → ${order.PASIEN}: ${rows.length} visits`)
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Done.
  Visits inserted:              ${inserted}
  Skipped (kode in packages):   ${skippedKode}
  Skipped (patient not found):  ${skippedNoPatient}
  Skipped (no done sessions):   ${skippedNoSessions}
  Skipped (duplicate):          ${skippedDup}
  Failures:                     ${failed}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
