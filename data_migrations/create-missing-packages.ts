/**
 * Finds patients whose old-system PAKET order count > new-system package count,
 * creates the missing patient_packages, and imports their sessions.
 *
 * Source: orders_with_sessions.json
 *
 * Run with: npx tsx data_migrations/create-missing-packages.ts
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
const SERVICE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ENCRYPTION_KEY   = process.env.ENCRYPTION_KEY!

if (!SUPABASE_URL || !SERVICE_KEY || !ENCRYPTION_KEY) {
  console.error('Missing env vars')
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
    const d = crypto.createDecipheriv('aes-256-gcm', encKey, Buffer.from(parts[0], 'hex'))
    d.setAuthTag(Buffer.from(parts[1], 'hex'))
    let r = d.update(parts[2], 'hex', 'utf8')
    r += d.final('utf8')
    return r
  } catch { return enc }
}

function normName(s: string): string { return s.trim().toUpperCase() }

// ── helpers ───────────────────────────────────────────────────────────────────
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

function deriveKehadiran(statusSesi: string): 'HADIR' | 'TIDAK HADIR' {
  return statusSesi === 'Tidak Hadir' ? 'TIDAK HADIR' : 'HADIR'
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

// ── package type → total_sessions mapping ────────────────────────────────────
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

function deriveTotalSessions(layanan: string, sessions: Session[]): number {
  const upper = layanan.toUpperCase()
  if (upper === 'PAKET 1' || upper === 'PAKET SILVER') return 5
  if (upper === 'PAKET 2' || upper === 'PAKET GOLD') return 10
  if (upper === 'PAKET PLATINUM') return 20
  // For custom packages (PENYESUAIAN, KHUSUS, HOME VISIT): count total session slots
  return Math.max(sessions?.length ?? 1, 1)
}

function deriveJenisPaket(layanan: string): 'P1' | 'P2' | null {
  const upper = layanan.toUpperCase()
  if (upper === 'PAKET 1' || upper === 'PAKET SILVER') return 'P1'
  if (upper === 'PAKET 2' || upper === 'PAKET GOLD') return 'P2'
  return null
}

const STATUS_MAP: Record<string, 'active' | 'completed'> = {
  Proses: 'active', Booking: 'active', Evaluasi: 'completed', Selesai: 'completed',
}

// ── load data ─────────────────────────────────────────────────────────────────
const MIGRATION_DIR = __dirname
const orders: Order[] = JSON.parse(
  fs.readFileSync(path.join(MIGRATION_DIR, 'orders_with_sessions.json'), 'utf8')
)
console.log(`Loaded ${orders.length} orders`)

// Group PAKET orders by patient name (non-Batal only)
const paketByPatient = new Map<string, Order[]>()
for (const o of orders) {
  if (!o.LAYANAN?.toUpperCase().startsWith('PAKET')) continue
  if (!STATUS_MAP[o.STATUS]) continue
  const name = normName(o.PASIEN)
  const list = paketByPatient.get(name) ?? []
  list.push(o)
  paketByPatient.set(name, list)
}

// ── supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  // Load profiles for therapist matching
  const { data: profilesData } = await supabase.from('internal_profiles').select('id, full_name')
  const profiles = profilesData ?? []

  // Load all patients (paginated)
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
  const idToName = new Map<string, string>()
  for (const p of allPatients) {
    const name = p.encrypted_name ? normName(decrypt(p.encrypted_name)) : ''
    if (name) { nameToId.set(name, p.id); idToName.set(p.id, name) }
  }
  console.log(`  ${allPatients.length} patients`)

  // Load all existing patient_packages
  console.log('\nFetching existing packages...')
  const allPkgs: {
    id: string; patient_id: string; package_name: string
    notes: string | null; created_at: string; status: string
  }[] = []
  let pkgFrom = 0
  while (true) {
    const { data, error } = await supabase.from('patient_packages')
      .select('id, patient_id, package_name, notes, created_at, status')
      .range(pkgFrom, pkgFrom + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    allPkgs.push(...data)
    if (data.length < PAGE) break
    pkgFrom += PAGE
  }
  console.log(`  ${allPkgs.length} existing packages`)

  // Group by patient
  const pkgsByPatient = new Map<string, typeof allPkgs>()
  for (const p of allPkgs) {
    const list = pkgsByPatient.get(p.patient_id) ?? []
    list.push(p)
    pkgsByPatient.set(p.patient_id, list)
  }

  let createdPkgs = 0
  let insertedSessions = 0
  let skippedAlreadyExists = 0
  let skippedNoPatient = 0
  let failures = 0

  // Process each patient that has PAKET orders
  for (const [name, oldOrders] of paketByPatient) {
    const patId = nameToId.get(name)
    if (!patId) { skippedNoPatient++; continue }

    const existingPkgs = pkgsByPatient.get(patId) ?? []

    // Build set of already-matched KODEs (from notes field)
    const matchedKodes = new Set<string>()
    for (const pkg of existingPkgs) {
      if (pkg.notes?.startsWith('kode:')) {
        matchedKodes.add(pkg.notes.replace('kode:', '').trim())
      }
    }

    // For packages WITHOUT kode, figure out which old order they match (best date+keyword)
    // and mark those KODEs as matched too
    const unmatchedExisting = existingPkgs.filter(p => !p.notes?.startsWith('kode:'))
    const unusedOrders = oldOrders.filter(o => !matchedKodes.has(o.KODE))

    for (const pkg of unmatchedExisting) {
      const pkgCreated = new Date(pkg.created_at)
      const upperPkgName = pkg.package_name.toUpperCase()

      // Find the closest-date order matching this package type
      const candidates = unusedOrders.filter(o => {
        const upperLayanan = o.LAYANAN.toUpperCase()
        const keyword = upperLayanan.replace('PAKET ', '')
        return upperPkgName.includes(keyword) || upperPkgName.includes(upperLayanan)
      })

      if (candidates.length === 0) continue

      const best = candidates.reduce((b, o) => {
        const oDate = o['DIBUAT TGL'] ? parseToDate(o['DIBUAT TGL']) : null
        const bDate = b['DIBUAT TGL'] ? parseToDate(b['DIBUAT TGL']) : null
        const dO = oDate ? daysBetween(pkgCreated, oDate) : Infinity
        const dB = bDate ? daysBetween(pkgCreated, bDate) : Infinity
        return dO < dB ? o : b
      })

      matchedKodes.add(best.KODE)
      // Remove from unusedOrders pool to avoid double-matching
      const idx = unusedOrders.indexOf(best)
      if (idx !== -1) unusedOrders.splice(idx, 1)
    }

    // Orders still not matched → these need new packages
    const ordersToCreate = oldOrders.filter(o => !matchedKodes.has(o.KODE))

    for (const order of ordersToCreate) {
      const newStatus = STATUS_MAP[order.STATUS] ?? 'active'
      const totalSessions = deriveTotalSessions(order.LAYANAN, order.sessions)
      const jenisPaket = deriveJenisPaket(order.LAYANAN)
      const createdAt = order['DIBUAT TGL'] ? parseDate(order['DIBUAT TGL']) : undefined

      // Create the package
      const { data: newPkg, error: createErr } = await supabase
        .from('patient_packages')
        .insert({
          patient_id:   patId,
          branch_id:    BRANCH_ID,
          package_name: order.LAYANAN,
          package_type: 'flexible',
          total_sessions: totalSessions,
          status:       newStatus,
          notes:        `kode:${order.KODE}`,
          jenis_paket:  jenisPaket,
          mulai_paket:  'NEW',
          operational_status: newStatus === 'completed' ? 'OFF' : 'ON',
          legacy_used_sessions: 0,
          ...(createdAt ? { created_at: createdAt } : {}),
        })
        .select('id')
        .single()

      if (createErr || !newPkg) {
        console.error(`  FAIL create pkg ${order.KODE} for ${name}: ${createErr?.message}`)
        failures++
        continue
      }

      createdPkgs++

      // Import sessions
      const doneSessions = order.sessions?.filter(
        s => s['NOMINAL BAYAR'] === 'Sudah Ditangani'
          || s.STATUS_SESI === 'Hadir'
          || s.STATUS_SESI === 'Tidak Hadir'
      ) ?? []
      if (doneSessions.length === 0) {
        console.log(`  CREATED ${order.KODE} → ${name} / ${order.LAYANAN} (0 done sessions)`)
        continue
      }

      const rows = doneSessions.map(s => {
        const keterangan = s.KETERANGAN?.trim()
        const isPaymentNote = /^Rp/.test(keterangan ?? '')
        return {
          patient_id:          patId,
          package_id:          newPkg.id,
          branch_id:           BRANCH_ID,
          visit_date:          parseDate(s.TANGGAL),
          shift:               deriveShift(s.JAM),
          service_type:        deriveVisitServiceType(order.LAYANAN),
          kehadiran:           deriveKehadiran(s.STATUS_SESI),
          status:              'completed',
          attending_staff_id:  matchTherapist(s.FISIO, profiles),
          notes:               (!isPaymentNote && keterangan && keterangan !== '-') ? keterangan : null,
        }
      })

      const { error: insertErr } = await supabase.from('patient_visits').insert(rows)
      if (insertErr) {
        console.error(`  FAIL insert sessions ${order.KODE}: ${insertErr.message}`)
        failures++
        continue
      }

      insertedSessions += rows.length
      console.log(`  CREATED ${order.KODE} → ${name} / ${order.LAYANAN}: ${rows.length} sessions`)
    }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Done.
  Packages created:         ${createdPkgs}
  Sessions inserted:        ${insertedSessions}
  Skipped (no patient):     ${skippedNoPatient}
  Failures:                 ${failures}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
