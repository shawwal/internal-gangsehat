/**
 * Full reset + reimport from orders_with_sessions.json.
 *
 * Phase 1: DELETE all patient_visits then all patient_packages.
 * Phase 2: For each PAKET order → create patient_package + import sessions.
 * Phase 3: For each non-PAKET order → import sessions as standalone patient_visits.
 *
 * No fuzzy matching — every order maps directly to a package or standalone visits
 * via the KODE field, eliminating all compound migration bugs from prior scripts.
 *
 * Run with: npx tsx data_migrations/full-reset-reimport.ts
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
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY')
  process.exit(1)
}

const BRANCH_ID = 'cfe27e13-ba0b-440d-99f3-03e059efb877'

// ── decryption ───────────────────────────────────────────────────────────────
const encKey = Buffer.from(ENCRYPTION_KEY, 'hex')

function decrypt(enc: string): string {
  if (!enc) return enc
  const parts = enc.split(':')
  if (parts.length !== 3) return enc
  try {
    const iv = Buffer.from(parts[0], 'hex')
    const tag = Buffer.from(parts[1], 'hex')
    // Only attempt decryption if it looks like a real AES-GCM payload
    if (iv.length !== 16 || tag.length !== 16) return enc
    const d = crypto.createDecipheriv('aes-256-gcm', encKey, iv)
    d.setAuthTag(tag)
    let r = d.update(parts[2], 'hex', 'utf8')
    r += d.final('utf8')
    return r
  } catch { return enc }
}

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

// ── helpers ───────────────────────────────────────────────────────────────────
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

function deriveTotalSessions(layanan: string, sessions: Session[]): number {
  const u = layanan.toUpperCase()
  if (u === 'PAKET 1' || u === 'PAKET SILVER') return 5
  if (u === 'PAKET 2' || u === 'PAKET GOLD')   return 10
  if (u === 'PAKET PLATINUM')                   return 20
  return Math.max(sessions?.length ?? 1, 1)
}

function deriveJenisPaket(layanan: string): 'P1' | 'P2' | null {
  const u = layanan.toUpperCase()
  if (u === 'PAKET 1' || u === 'PAKET SILVER') return 'P1'
  if (u === 'PAKET 2' || u === 'PAKET GOLD')   return 'P2'
  return null
}

function deriveStatus(status: string): 'active' | 'completed' {
  return (status === 'Proses' || status === 'Booking') ? 'active' : 'completed'
}

function deriveOperationalStatus(status: string): string {
  if (status === 'Proses')   return 'ON'
  if (status === 'Booking')  return 'PENDING'
  return 'OFF'
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

function buildVisitRows(
  order: Order,
  patientId: string,
  packageId: string | null,
  profiles: { id: string; full_name: string }[],
): object[] {
  const seen = new Set<string>()
  const rows: object[] = []
  for (const s of doneSessions(order.sessions)) {
    const visitDate = parseDate(s.TANGGAL)
    if (!visitDate) continue
    const shift = deriveShift(s.JAM)
    const key = `${visitDate}::${shift}`
    if (seen.has(key)) continue
    seen.add(key)
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

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  // ── Load reference data ───────────────────────────────────────────────────
  const { data: profilesData } = await supabase.from('internal_profiles').select('id, full_name')
  const profiles = profilesData ?? []
  console.log(`Loaded ${profiles.length} staff profiles`)

  console.log('\nFetching patients...')
  const allPatients: { id: string; encrypted_name: string }[] = []
  const PAGE = 1000
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

  // ── Phase 1: Delete ───────────────────────────────────────────────────────
  // Null out visit_id on transactions first (FK constraint)
  console.log('\n── Phase 1: Unlinking transactions.visit_id...')
  const { error: unlinkErr } = await supabase.from('transactions')
    .update({ visit_id: null }).not('visit_id', 'is', null)
  if (unlinkErr) throw new Error(`Unlink transactions: ${unlinkErr.message}`)
  console.log('  transactions.visit_id unlinked.')

  console.log('  Deleting all patient_visits...')
  const { error: delVisitsErr } = await supabase.from('patient_visits')
    .delete().gte('id', '00000000-0000-0000-0000-000000000000')
  if (delVisitsErr) throw new Error(`Delete visits: ${delVisitsErr.message}`)
  console.log('  patient_visits deleted.')

  console.log('  Deleting all patient_packages...')
  const { error: delPkgsErr } = await supabase.from('patient_packages')
    .delete().gte('id', '00000000-0000-0000-0000-000000000000')
  if (delPkgsErr) throw new Error(`Delete packages: ${delPkgsErr.message}`)
  console.log('  patient_packages deleted.')

  // ── Phase 2: PAKET orders → packages + visits ─────────────────────────────
  console.log('\n── Phase 2: Importing PAKET orders...')
  const paketOrders = orders.filter(o => o.LAYANAN?.toUpperCase().startsWith('PAKET'))
  console.log(`  ${paketOrders.length} PAKET orders`)

  let pkgsCreated = 0
  let pkgSessionsInserted = 0
  let pkgNoPatient = 0
  let pkgFailed = 0

  for (const order of paketOrders) {
    const patientId = nameToId.get(normName(order.PASIEN))
    if (!patientId) { pkgNoPatient++; continue }

    const totalSessions = deriveTotalSessions(order.LAYANAN, order.sessions)
    const createdAt = parseDate(order['DIBUAT TGL'])

    const { data: newPkg, error: createErr } = await supabase
      .from('patient_packages')
      .insert({
        patient_id:           patientId,
        branch_id:            BRANCH_ID,
        package_name:         order.LAYANAN,
        package_type:         'fixed',
        total_sessions:       totalSessions,
        jenis_paket:          deriveJenisPaket(order.LAYANAN),
        mulai_paket:          'NEW',
        operational_status:   deriveOperationalStatus(order.STATUS),
        status:               deriveStatus(order.STATUS),
        notes:                `kode:${order.KODE}`,
        legacy_used_sessions: 0,
        ...(createdAt ? { created_at: createdAt } : {}),
      })
      .select('id')
      .single()

    if (createErr || !newPkg) {
      console.error(`  FAIL pkg ${order.KODE} (${order.PASIEN}): ${createErr?.message}`)
      pkgFailed++
      continue
    }

    pkgsCreated++

    const rows = buildVisitRows(order, patientId, newPkg.id, profiles)
    if (rows.length === 0) {
      console.log(`  PKG ${order.KODE} → ${order.PASIEN} / ${order.LAYANAN}: 0 sessions`)
      continue
    }

    const { error: insertErr } = await supabase.from('patient_visits').insert(rows)
    if (insertErr) {
      console.error(`  FAIL sessions ${order.KODE}: ${insertErr.message}`)
      pkgFailed++
      continue
    }

    pkgSessionsInserted += rows.length
    console.log(`  PKG ${order.KODE} → ${order.PASIEN} / ${order.LAYANAN}: ${rows.length} sessions`)
  }

  // ── Phase 3: Non-PAKET orders → standalone visits ─────────────────────────
  console.log('\n── Phase 3: Importing standalone visits (non-PAKET)...')
  const standaloneOrders = orders.filter(o => !o.LAYANAN?.toUpperCase().startsWith('PAKET'))
  console.log(`  ${standaloneOrders.length} non-PAKET orders`)

  let standaloneInserted = 0
  let standaloneNoPatient = 0
  let standaloneNoSessions = 0
  let standaloneFailed = 0

  for (const order of standaloneOrders) {
    const patientId = nameToId.get(normName(order.PASIEN))
    if (!patientId) { standaloneNoPatient++; continue }

    const rows = buildVisitRows(order, patientId, null, profiles)
    if (rows.length === 0) { standaloneNoSessions++; continue }

    const { error } = await supabase.from('patient_visits').insert(rows)
    if (error) {
      console.error(`  FAIL standalone ${order.KODE} (${order.PASIEN}): ${error.message}`)
      standaloneFailed++
      continue
    }

    standaloneInserted += rows.length
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Done.

Phase 2 — PAKET packages:
  Packages created:            ${pkgsCreated}
  Package sessions inserted:   ${pkgSessionsInserted}
  Skipped (patient not found): ${pkgNoPatient}
  Failures:                    ${pkgFailed}

Phase 3 — Standalone visits:
  Visits inserted:             ${standaloneInserted}
  Skipped (patient not found): ${standaloneNoPatient}
  Skipped (0 done sessions):   ${standaloneNoSessions}
  Failures:                    ${standaloneFailed}

Total visits:                  ${pkgSessionsInserted + standaloneInserted}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
