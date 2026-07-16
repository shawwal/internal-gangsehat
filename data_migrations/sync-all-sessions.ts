/**
 * Full reset + re-import of all legacy package sessions.
 *
 * Source: orders_with_sessions.json (sessions embedded per order — single source of truth)
 *
 * Steps:
 *   1. DELETE all patient_visits WHERE package_id IS NOT NULL (migration rows only)
 *   2. RESET all patient_packages.legacy_used_sessions = 0
 *   3. For each package:
 *        a. KODE-exact: notes LIKE 'kode:TRX/%' → look up order by exact KODE
 *        b. Name-fuzzy: decrypt patient name → match by name + package keyword + date
 *   4. Insert "Sudah Ditangani" sessions as patient_visits linked via package_id
 *   5. Update package status from old-system order status
 *
 * Run with: npx tsx data_migrations/sync-all-sessions.ts
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

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ENCRYPTION_KEY    = process.env.ENCRYPTION_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ENCRYPTION_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY')
  process.exit(1)
}

const BRANCH_ID = 'cfe27e13-ba0b-440d-99f3-03e059efb877'  // Fisioterapi Gang Sehat Pontianak

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
      const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, Buffer.from(parts[0], 'hex'))
      decipher.setAuthTag(Buffer.from(parts[1], 'hex'))
      let d = decipher.update(parts[2], 'hex', 'utf8')
      d += decipher.final('utf8')
      return d
    } catch { /* fall through */ }
  }
  return enc
}

function normName(s: string): string {
  return s.trim().toUpperCase()
}

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

const MIGRATION_DIR = __dirname
const orders: Order[] = JSON.parse(
  fs.readFileSync(path.join(MIGRATION_DIR, 'orders_with_sessions.json'), 'utf8')
)
console.log(`Loaded ${orders.length} orders from orders_with_sessions.json`)

// Index by KODE for fast exact lookup
const orderByKode = new Map<string, Order>()
for (const o of orders) orderByKode.set(o.KODE, o)

// Group PAKET orders by patient name for fuzzy matching
const STATUS_MAP: Record<string, 'active' | 'completed'> = {
  Proses: 'active', Booking: 'active', Evaluasi: 'completed', Selesai: 'completed', Stop: 'completed',
}

const paketByPatient = new Map<string, Order[]>()
for (const o of orders) {
  if (!o.LAYANAN?.toUpperCase().startsWith('PAKET')) continue
  if (!STATUS_MAP[o.STATUS]) continue  // skip Batal
  const name = normName(o.PASIEN)
  const list = paketByPatient.get(name) ?? []
  list.push(o)
  paketByPatient.set(name, list)
}

// Sessions to import: attended (Hadir), missed (Tidak Hadir), or billing confirmed.
// Excludes only sessions with no recorded status yet (STATUS_SESI = '-').
function doneSessions(o: Order): Session[] {
  return o.sessions?.filter(
    s => s['NOMINAL BAYAR'] === 'Sudah Ditangani'
      || s.STATUS_SESI === 'Hadir'
      || s.STATUS_SESI === 'Tidak Hadir'
  ) ?? []
}

// ── helpers ───────────────────────────────────────────────────────────────────
function parseDate(dmy: string): string | null {
  // "DD-MM-YYYY" → "YYYY-MM-DD"
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
  if (statusSesi === 'Tidak Hadir') return 'TIDAK HADIR'
  return 'HADIR'
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

// ── supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function fetchAll<T>(
  query: ReturnType<typeof supabase.from>,
  select: string,
  extraFilters?: (q: any) => any,
): Promise<T[]> {
  const PAGE = 1000
  const results: T[] = []
  let from = 0
  while (true) {
    let q = supabase.from(query as any).select(select).range(from, from + PAGE - 1)
    if (extraFilters) q = extraFilters(q)
    const { data, error } = await (q as any)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    results.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return results
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Fetch internal_profiles for therapist matching
  const { data: profilesData } = await supabase.from('internal_profiles').select('id, full_name')
  const profiles = profilesData ?? []
  console.log(`\nLoaded ${profiles.length} staff profiles`)

  // 2. Fetch all patients and build name↔id maps
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
  console.log(`  ${allPatients.length} patients, ${nameToId.size} decrypted`)

  // 3. Fetch all patient_packages
  console.log('\nFetching patient_packages...')
  const allPkgs: {
    id: string; patient_id: string; package_name: string
    total_sessions: number; status: string; notes: string | null
    legacy_used_sessions: number; created_at: string
  }[] = []
  let pkgFrom = 0
  while (true) {
    const { data, error } = await supabase.from('patient_packages')
      .select('id, patient_id, package_name, total_sessions, status, notes, legacy_used_sessions, created_at')
      .range(pkgFrom, pkgFrom + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    allPkgs.push(...data)
    if (data.length < PAGE) break
    pkgFrom += PAGE
  }
  console.log(`  ${allPkgs.length} packages`)

  // 4. Delete all package-linked visits (clean slate)
  console.log('\nDeleting all package-linked patient_visits...')
  const { error: delErr } = await supabase.from('patient_visits')
    .delete().not('package_id', 'is', null)
  if (delErr) throw new Error(`Delete failed: ${delErr.message}`)
  console.log('  Deleted.')

  // 5. Reset all legacy_used_sessions to 0
  console.log('\nResetting all legacy_used_sessions to 0...')
  const { error: resetErr } = await supabase.from('patient_packages')
    .update({ legacy_used_sessions: 0 })
    .gte('id', '00000000-0000-0000-0000-000000000000')
  if (resetErr) throw new Error(`Reset failed: ${resetErr.message}`)
  console.log('  Reset.')

  // 6. Process each package
  let inserted = 0
  let skippedNoSessions = 0
  let skippedNoMatch = 0
  let failed = 0
  let statusUpdated = 0

  for (const pkg of allPkgs) {
    const pkgCreated = new Date(pkg.created_at)
    const upperPkgName = pkg.package_name.toUpperCase()

    // --- Try KODE-exact match first ---
    let matchedOrder: Order | null = null

    if (pkg.notes?.startsWith('kode:')) {
      const kode = pkg.notes.replace('kode:', '').trim()
      matchedOrder = orderByKode.get(kode) ?? null
    }

    // --- Fallback: fuzzy name + layanan + date ---
    if (!matchedOrder) {
      const patientName = idToName.get(pkg.patient_id)
      if (!patientName) { skippedNoMatch++; continue }

      const candidates = (paketByPatient.get(patientName) ?? []).filter(o => {
        const upperLayanan = o.LAYANAN.toUpperCase()
        const keyword = upperLayanan.replace('PAKET ', '')
        return upperPkgName.includes(keyword) || upperPkgName.includes(upperLayanan)
      })

      if (candidates.length === 0) { skippedNoMatch++; continue }

      // Prefer candidates that have done sessions; among those pick closest date
      const withDone = candidates.filter(o => doneSessions(o).length > 0)
      const pool = withDone.length > 0 ? withDone : candidates

      if (pool.length === 1) {
        matchedOrder = pool[0]
      } else {
        matchedOrder = pool.reduce((best, o) => {
          const oDate = o['DIBUAT TGL'] ? parseToDate(o['DIBUAT TGL']) : null
          const bestDate = best['DIBUAT TGL'] ? parseToDate(best['DIBUAT TGL']) : null
          const dO = oDate ? daysBetween(pkgCreated, oDate) : Infinity
          const dBest = bestDate ? daysBetween(pkgCreated, bestDate) : Infinity
          return dO < dBest ? o : best
        })
      }
    }

    if (!matchedOrder) { skippedNoMatch++; continue }

    // Update package status from order
    const newStatus = STATUS_MAP[matchedOrder.STATUS]
    if (newStatus && newStatus !== pkg.status) {
      await supabase.from('patient_packages').update({ status: newStatus }).eq('id', pkg.id)
      statusUpdated++
    }

    // Get completed sessions
    const sessions = doneSessions(matchedOrder)
    if (sessions.length === 0) {
      skippedNoSessions++
      continue
    }

    // Build visit rows
    const rows = sessions.map(s => {
      const keterangan = s.KETERANGAN?.trim()
      const isPaymentNote = /^Rp/.test(keterangan ?? '')
      return {
        patient_id:          pkg.patient_id,
        package_id:          pkg.id,
        branch_id:           BRANCH_ID,
        visit_date:          parseDate(s.TANGGAL),
        visit_time:          s.JAM && s.JAM !== '-' ? s.JAM : null,
        shift:               deriveShift(s.JAM),
        service_type:        deriveVisitServiceType(matchedOrder.LAYANAN),
        kehadiran:           deriveKehadiran(s.STATUS_SESI),
        status:              'completed',
        attending_staff_id:  matchTherapist(s.FISIO, profiles),
        notes:               (!isPaymentNote && keterangan && keterangan !== '-') ? keterangan : null,
      }
    })

    const { error: insertErr } = await supabase.from('patient_visits').insert(rows)
    if (insertErr) {
      console.error(`  FAIL ${matchedOrder.KODE} → ${pkg.package_name} [${pkg.id}]: ${insertErr.message}`)
      failed++
      continue
    }

    console.log(`  OK ${matchedOrder.KODE} → ${pkg.package_name}: ${rows.length} sessions`)
    inserted += rows.length
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Done.
  Packages processed:                ${allPkgs.length}
  Sessions inserted:                  ${inserted}
  Status updated:                     ${statusUpdated}
  Skipped (no matching order found):  ${skippedNoMatch}
  Skipped (order has 0 done sessions): ${skippedNoSessions}
  Failures:                           ${failed}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
