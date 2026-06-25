/**
 * One-time migration: sync legacy session counts from old system into patient_packages.legacy_used_sessions
 *
 * Data sources:
 *   - orders_medical_records.json → session-level data: KODE + SESSION_STATUS="Sudah Ditangani"
 *   - orders_fisiotherapy.json    → order-level data: KODE, PASIEN, LAYANAN, STATUS, DIBUAT TGL
 *
 * sessions_done per KODE = count of SESSION_STATUS="Sudah Ditangani" rows in medical_records
 *
 * Run with:
 *   npx tsx data_migrations/sync-package-sessions.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, and ENCRYPTION_KEY in .env
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
  console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY')
  process.exit(1)
}

// ── decryption (same logic as lib/encryption.ts) ──────────────────────────────
const ALGORITHM = 'aes-256-gcm'
const encKey = Buffer.from(ENCRYPTION_KEY, 'hex')

function isEncryptedFormat(text: string): boolean {
  const parts = text.split(':')
  if (parts.length !== 3) return false
  const hexPattern = /^[0-9a-fA-F]+$/
  return parts[0].length === 32 && parts[1].length === 32 && hexPattern.test(parts[0]) && hexPattern.test(parts[1])
}

function tryDecodeBase64(text: string): string | null {
  try {
    const decoded = Buffer.from(text, 'base64').toString('utf8')
    const printable = decoded.replace(/[^\x20-\x7E -￿]/g, '')
    return printable.length >= decoded.length * 0.8 ? decoded : null
  } catch {
    return null
  }
}

function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText

  if (isEncryptedFormat(encryptedText)) {
    try {
      const parts = encryptedText.split(':')
      const iv = Buffer.from(parts[0], 'hex')
      const authTag = Buffer.from(parts[1], 'hex')
      const decipher = crypto.createDecipheriv(ALGORITHM, encKey, iv)
      decipher.setAuthTag(authTag)
      let decrypted = decipher.update(parts[2], 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch { /* fall through */ }
  }

  const base64Pattern = /^[A-Za-z0-9+/]+=*$/
  if (encryptedText.length >= 4 && base64Pattern.test(encryptedText)) {
    const decoded = tryDecodeBase64(encryptedText)
    if (decoded) return decoded
  }

  return encryptedText
}

// ── status mapping ─────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, 'active' | 'completed' | 'cancelled'> = {
  'Proses':    'active',
  'Booking':   'active',
  'Evaluasi':  'completed',
  'Selesai':   'completed',
  'Batal':     'cancelled',
}

// ── helpers ────────────────────────────────────────────────────────────────────
function normalizeName(name: string): string {
  return name.trim().toUpperCase()
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs((a.getTime() - b.getTime()) / 86_400_000)
}

function parseIndonesianDate(dmy: string): Date | null {
  const [d, m, y] = dmy.split('-')
  if (!d || !m || !y) return null
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
}

// ── load source data ───────────────────────────────────────────────────────────
interface MedicalRecord {
  KODE: string
  PASIEN: string
  SESSION_STATUS: string
}

interface FisioRecord {
  KODE: string
  PASIEN: string
  LAYANAN: string
  STATUS: string
  'DIBUAT TGL': string
}

interface MergedOrder {
  kode: string
  pasien: string
  layanan: string
  status: string
  sessionsDone: number
  dibuatTgl: Date | null
}

const MIGRATION_DIR = __dirname

const medicalRaw: MedicalRecord[] = JSON.parse(
  fs.readFileSync(path.join(MIGRATION_DIR, 'orders_medical_records.json'), 'utf8')
)
const fisioRaw: FisioRecord[] = JSON.parse(
  fs.readFileSync(path.join(MIGRATION_DIR, 'orders_fisiotherapy.json'), 'utf8')
)

// Count "Sudah Ditangani" sessions per KODE (actual completed sessions in old system)
const sessionsDoneByKode = new Map<string, number>()
for (const r of medicalRaw) {
  if (r.SESSION_STATUS === 'Sudah Ditangani') {
    sessionsDoneByKode.set(r.KODE, (sessionsDoneByKode.get(r.KODE) ?? 0) + 1)
  }
}

// Build merged orders from fisiotherapy (all PAKET orders, non-cancelled)
const merged: MergedOrder[] = []
for (const f of fisioRaw) {
  const layanan = (f.LAYANAN || '').trim()
  if (!layanan.toUpperCase().startsWith('PAKET')) continue

  const mappedStatus = STATUS_MAP[f.STATUS]
  if (!mappedStatus || mappedStatus === 'cancelled') continue

  merged.push({
    kode: f.KODE,
    pasien: normalizeName(f.PASIEN),
    layanan,
    status: mappedStatus,
    sessionsDone: sessionsDoneByKode.get(f.KODE) ?? 0,
    dibuatTgl: f['DIBUAT TGL'] ? parseIndonesianDate(f['DIBUAT TGL']) : null,
  })
}

console.log(`Loaded ${merged.length} PAKET orders from fisiotherapy`)
console.log(`  ${merged.filter(m => m.sessionsDone > 0).length} have sessions done in medical_records`)

// ── connect to Supabase ────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ── main ───────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Fetch ALL patients with pagination and decrypt names
  console.log('\nFetching patients...')
  const allPatients: { id: string; encrypted_name: string }[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error: pErr } = await supabase
      .from('patients')
      .select('id, encrypted_name')
      .range(from, from + PAGE - 1)
    if (pErr) throw new Error(`patients fetch failed: ${pErr.message}`)
    if (!data?.length) break
    allPatients.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }

  const nameToId = new Map<string, string>()
  for (const p of allPatients) {
    const decName = p.encrypted_name ? normalizeName(decrypt(p.encrypted_name)) : ''
    if (decName) nameToId.set(decName, p.id)
  }
  console.log(`  Fetched ${allPatients.length} patients, decrypted ${nameToId.size} names`)

  // 2. Fetch all patient_packages with pagination
  console.log('\nFetching patient_packages...')
  const allPackages: {
    id: string; patient_id: string; package_name: string
    total_sessions: number; status: string; created_at: string
  }[] = []
  let pkgFrom = 0
  while (true) {
    const { data, error: pkgErr } = await supabase
      .from('patient_packages')
      .select('id, patient_id, package_name, total_sessions, status, created_at')
      .range(pkgFrom, pkgFrom + PAGE - 1)
    if (pkgErr) throw new Error(`patient_packages fetch failed: ${pkgErr.message}`)
    if (!data?.length) break
    allPackages.push(...data)
    if (data.length < PAGE) break
    pkgFrom += PAGE
  }
  console.log(`  Loaded ${allPackages.length} packages`)

  // Group by patient_id for fast lookup
  const pkgsByPatient = new Map<string, typeof allPackages>()
  for (const pkg of allPackages) {
    const list = pkgsByPatient.get(pkg.patient_id) ?? []
    list.push(pkg)
    pkgsByPatient.set(pkg.patient_id, list)
  }

  // 3. Reset all packages to legacy_used_sessions = 0 first (clean slate)
  console.log('\nResetting all legacy_used_sessions to 0...')
  const { error: resetErr } = await supabase
    .from('patient_packages')
    .update({ legacy_used_sessions: 0 })
    .gte('id', '00000000-0000-0000-0000-000000000000')  // match all rows
  if (resetErr) throw new Error(`Reset failed: ${resetErr.message}`)
  console.log('  Reset complete.')

  // 4. Match each old order to a new-system package and build updates
  const updates: { id: string; legacy_used_sessions: number; status: string }[] = []
  const unmatched: MergedOrder[] = []
  const skippedOverflow: { order: MergedOrder; pkg: typeof allPackages[0]; proposed: number }[] = []

  for (const order of merged) {
    const patientId = nameToId.get(order.pasien)
    if (!patientId) {
      unmatched.push(order)
      continue
    }

    const candidates = (pkgsByPatient.get(patientId) ?? []).filter((pkg) => {
      const upperPkgName = pkg.package_name.toUpperCase()
      const upperLayanan = order.layanan.toUpperCase()
      const keyword = upperLayanan.replace('PAKET ', '')
      return upperPkgName.includes(keyword) || upperPkgName.includes(upperLayanan)
    })

    if (candidates.length === 0) {
      unmatched.push(order)
      continue
    }

    // Pick closest created_at to DIBUAT TGL
    let best = candidates[0]
    if (candidates.length > 1 && order.dibuatTgl) {
      best = candidates.reduce((closest, pkg) => {
        const dClosest = daysBetween(new Date(closest.created_at), order.dibuatTgl!)
        const dPkg     = daysBetween(new Date(pkg.created_at), order.dibuatTgl!)
        return dPkg < dClosest ? pkg : closest
      })
    }

    // Cap at total_sessions — a package cannot have more legacy sessions than its size
    const capped = Math.min(order.sessionsDone, best.total_sessions)

    if (order.sessionsDone > best.total_sessions) {
      skippedOverflow.push({ order, pkg: best, proposed: order.sessionsDone })
    }

    updates.push({
      id: best.id,
      legacy_used_sessions: capped,
      status: order.status,
    })
  }

  console.log(`\nMatched: ${updates.length} | Unmatched: ${unmatched.length}`)
  if (skippedOverflow.length > 0) {
    console.log(`\nWarning: ${skippedOverflow.length} packages had sessionsDone > total_sessions (capped):`)
    for (const s of skippedOverflow) {
      console.log(`  ${s.order.kode} ${s.order.pasien} ${s.order.layanan}: proposed=${s.proposed} → capped to ${s.pkg.total_sessions}`)
    }
  }

  if (unmatched.length > 0) {
    const outPath = path.join(MIGRATION_DIR, 'unmatched_packages.json')
    fs.writeFileSync(outPath, JSON.stringify(unmatched, null, 2))
    console.log(`\nUnmatched written to ${outPath}`)
  }

  if (updates.length === 0) {
    console.log('\nNo updates to apply.')
    return
  }

  // 5. Apply updates
  console.log('\nApplying updates...')
  let successCount = 0
  let failCount = 0

  for (const update of updates) {
    const { error } = await supabase
      .from('patient_packages')
      .update({
        legacy_used_sessions: update.legacy_used_sessions,
        status: update.status,
      })
      .eq('id', update.id)

    if (error) {
      console.error(`  FAIL [${update.id}]: ${error.message}`)
      failCount++
    } else {
      successCount++
    }
  }

  console.log(`\nDone. Updated: ${successCount} | Failed: ${failCount}`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
