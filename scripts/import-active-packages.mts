/**
 * Import active packages from orders_paket.json → patient_packages table.
 * Run: npx tsx scripts/import-active-packages.mts
 *
 * Sources:
 *   data_migrations/orders_paket.json      — 374 active orders (Proses / Booking)
 *   data_migrations/orders_medical_records.json — session dates per order (for t1–t10)
 *
 * Strategy:
 *  1. Load medical records JSON → build KODE → completed session dates map
 *  2. Decrypt patient names from DB → name→id lookup
 *  3. Load existing patient_packages.notes to detect already-imported KODEs (idempotent)
 *  4. Resolve branch (first active branch)
 *  5. Per order in orders_paket.json: match patient, build package row, insert
 */

import { createDecipheriv } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Load env ─────────────────────────────────────────────────────────────────
const envRaw = readFileSync(join(__dirname, '../.env'), 'utf8')
const env: Record<string, string> = {}
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim()
}

const SUPABASE_URL     = env['NEXT_PUBLIC_SUPABASE_URL']  ?? ''
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''
const ENCRYPTION_KEY   = env['ENCRYPTION_KEY']            ?? ''

const PAKET_PATH    = join(__dirname, '../data_migrations/orders_paket.json')
const MEDICAL_PATH  = join(__dirname, '../data_migrations/orders_medical_records.json')

// ── Decrypt helper (mirrors lib/encryption.ts) ────────────────────────────────
const encKey = Buffer.from(ENCRYPTION_KEY, 'hex')

function decrypt(text: string): string {
  if (!text) return ''
  const parts = text.split(':')
  if (parts.length !== 3) return text
  if (parts[0].length !== 32 || parts[1].length !== 32) return text
  try {
    const iv       = Buffer.from(parts[0], 'hex')
    const authTag  = Buffer.from(parts[1], 'hex')
    const decipher = createDecipheriv('aes-256-gcm', encKey, iv)
    decipher.setAuthTag(authTag)
    return decipher.update(parts[2], 'hex', 'utf8') + decipher.final('utf8')
  } catch {
    try {
      const decoded   = Buffer.from(text, 'base64').toString('utf8')
      const printable = decoded.replace(/[^\x20-\x7E -￿]/g, '')
      if (printable.length >= decoded.length * 0.8) return decoded
    } catch { /* ignore */ }
    return text
  }
}

function normalizeName(name: string): string {
  return name.toUpperCase().trim().replace(/\s+/g, ' ')
}

// Parse "24-06-2026" (DD-MM-YYYY) → "2026-06-24"; returns null for "-" or 1970 sentinel
function parseDate(val: string | null | undefined): string | null {
  if (!val || val === '-') return null
  const parts = String(val).split('-')
  if (parts.length !== 3) return null
  const [dd, mm, yyyy] = parts
  if (yyyy === '1970') return null
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

// Parse "5x" or "10x" → 5 / 10; falls back to 1
function parseSessions(val: string | null | undefined): number {
  if (!val) return 1
  const n = parseInt(String(val).replace(/[^0-9]/g, ''), 10)
  return n > 0 ? n : 1
}

// ── Package name → (jenis_paket, canonical total_sessions) ───────────────────
function mapPackage(layanan: string, totalFromData: number): {
  package_name: string
  jenis_paket: 'P1' | 'P2' | null
  total_sessions: number
} {
  const l = layanan.toUpperCase().trim()

  if (l === 'PAKET 1' || l === 'PAKET SILVER')
    return { package_name: layanan, jenis_paket: 'P1', total_sessions: Math.max(totalFromData, 5) }
  if (l === 'PAKET 2' || l === 'PAKET GOLD')
    return { package_name: layanan, jenis_paket: 'P2', total_sessions: Math.max(totalFromData, 10) }
  if (l === 'PAKET PLATINUM')
    return { package_name: layanan, jenis_paket: null, total_sessions: Math.max(totalFromData, 20) }
  if (l === 'PAKET KHUSUS' || l === 'PAKET PENYESUAIAN')
    return { package_name: layanan, jenis_paket: null, total_sessions: totalFromData }

  // TERAPI AWAL, SESI NEW, HOME VISIT, etc.
  return { package_name: layanan, jenis_paket: null, total_sessions: totalFromData }
}

function mapOperationalStatus(status: string): 'ON' | 'PENDING' | 'OFF' {
  if (status === 'Proses') return 'ON'
  if (status === 'Booking') return 'PENDING'
  return 'OFF'
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // 1. Build KODE → sorted "Hadir" session dates from medical records
  console.log('📖 Reading medical records for session dates...')
  type MedRecord = { KODE: string; SESSION_TANGGAL: string; SESSION_STATUS: string }
  const medRecords: MedRecord[] = JSON.parse(readFileSync(MEDICAL_PATH, 'utf8'))

  const kodeToHadirDates = new Map<string, string[]>()
  for (const r of medRecords) {
    const kode = (r.KODE ?? '').trim()
    if (!kode) continue
    if ((r.SESSION_STATUS ?? '').trim() !== 'Hadir') continue
    const d = parseDate(r.SESSION_TANGGAL)
    if (!d) continue
    if (!kodeToHadirDates.has(kode)) kodeToHadirDates.set(kode, [])
    kodeToHadirDates.get(kode)!.push(d)
  }
  // Sort each list ascending
  for (const [, dates] of kodeToHadirDates) dates.sort()
  console.log(`   ${kodeToHadirDates.size} orders have completed (Hadir) sessions`)

  // 2. Load orders_paket.json
  console.log('\n📖 Reading orders_paket.json...')
  type PaketOrder = {
    KODE: string
    PASIEN: string
    LAYANAN: string
    STATUS: string
    ADMIN: string
    'TOTAL PERTEMUAN': string
    'PERTEMUAN TERAKHIR': string
    'PERTEMUAN SELANJUTNYA': string
  }
  const paketOrders: PaketOrder[] = JSON.parse(readFileSync(PAKET_PATH, 'utf8'))
  console.log(`   ${paketOrders.length} active package orders found`)

  // 3. Build name → patient_id lookup
  console.log('\n🔓 Loading + decrypting patient names from DB...')
  const nameToId = new Map<string, string>()
  let patFrom = 0
  const PAT_PAGE = 500
  let totalPatients = 0
  while (true) {
    const { data, error } = await supabase
      .from('patients')
      .select('id, encrypted_name')
      .eq('is_active', true)
      .range(patFrom, patFrom + PAT_PAGE - 1)
    if (error) { console.error('   Error:', error.message); break }
    if (!data?.length) break
    for (const p of data) {
      if (!p.encrypted_name) continue
      try {
        const name = decrypt(p.encrypted_name)
        if (name) nameToId.set(normalizeName(name), p.id)
      } catch { /* skip */ }
    }
    totalPatients += data.length
    process.stdout.write(`\r   Loaded ${totalPatients} patients...`)
    if (data.length < PAT_PAGE) break
    patFrom += PAT_PAGE
  }
  console.log(`\r   ${nameToId.size} unique patient names from ${totalPatients} records`)

  // 4. Load existing patient_packages.notes to detect already-imported KODEs
  console.log('\n📦 Checking existing packages in DB...')
  const existingKodes = new Set<string>()
  let pkgFrom = 0
  const PKG_PAGE = 500
  while (true) {
    const { data, error } = await supabase
      .from('patient_packages')
      .select('notes')
      .range(pkgFrom, pkgFrom + PKG_PAGE - 1)
    if (error) { console.error('   Error:', error.message); break }
    if (!data?.length) break
    for (const p of data as { notes: string | null }[]) {
      if (p.notes) {
        // notes may contain "kode:TRX/..." prefix or just the kode
        const m = p.notes.match(/TRX\/\d{4}\/\d{2}\/\d{4}/)
        if (m) existingKodes.add(m[0])
      }
    }
    if (data.length < PKG_PAGE) break
    pkgFrom += PKG_PAGE
  }
  console.log(`   ${existingKodes.size} packages already imported (will be skipped)`)

  // 5. Resolve branch
  console.log('\n🏥 Resolving branch...')
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('is_active', true)
    .order('name')
  const branch = branches?.[0]
  if (!branch) { console.error('❌ No active branches found.'); process.exit(1) }
  console.log(`   Branch: ${branch.name} (${branch.id})`)

  // 6. Insert packages
  console.log('\n⬆️  Importing packages...\n')
  let imported  = 0
  let skipped   = 0
  let notFound  = 0
  let errors    = 0
  const notFoundNames: string[] = []
  const errorList: string[] = []

  for (let i = 0; i < paketOrders.length; i++) {
    const o    = paketOrders[i]
    const kode = (o.KODE ?? '').trim()

    if (!kode) { skipped++; continue }

    if (existingKodes.has(kode)) {
      skipped++
      process.stdout.write(`\r   [${i + 1}/${paketOrders.length}] ✅ ${imported}  ↷ ${skipped}  ? ${notFound}  ❌ ${errors}`)
      continue
    }

    const pasien    = (o.PASIEN ?? '').trim()
    const patientId = nameToId.get(normalizeName(pasien))

    if (!patientId) {
      notFound++
      notFoundNames.push(pasien)
      process.stdout.write(`\r   [${i + 1}/${paketOrders.length}] ✅ ${imported}  ↷ ${skipped}  ? ${notFound}  ❌ ${errors}`)
      continue
    }

    const totalFromData = parseSessions(o['TOTAL PERTEMUAN'])
    const { package_name, jenis_paket, total_sessions } = mapPackage(o.LAYANAN ?? '', totalFromData)
    const operationalStatus = mapOperationalStatus(o.STATUS ?? '')
    const lastSessionDate   = parseDate(o['PERTEMUAN TERAKHIR'])

    // Fill t1–t10 from completed sessions (Hadir) for this KODE
    const hadirDates = kodeToHadirDates.get(kode) ?? []
    const tDates: Record<string, string | undefined> = {}
    for (let n = 1; n <= 10; n++) {
      const d = hadirDates[n - 1]
      if (d) tDates[`t${n}`] = d
    }

    const createdAt = lastSessionDate
      ? new Date(lastSessionDate).toISOString()
      : new Date().toISOString()

    const { error: insertErr } = await supabase
      .from('patient_packages')
      .insert({
        patient_id:         patientId,
        branch_id:          branch.id,
        package_name,
        package_type:       'fixed',
        total_sessions,
        jenis_paket,
        mulai_paket:        'NEW',
        operational_status: operationalStatus,
        status:             'active',
        notes:              `kode:${kode}`,
        created_at:         createdAt,
        updated_at:         new Date().toISOString(),
        ...tDates,
      })

    if (insertErr) {
      errors++
      errorList.push(`${kode} (${pasien}): ${insertErr.message}`)
    } else {
      imported++
      existingKodes.add(kode)
    }

    process.stdout.write(`\r   [${i + 1}/${paketOrders.length}] ✅ ${imported}  ↷ ${skipped}  ? ${notFound}  ❌ ${errors}`)
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n\n' + '─'.repeat(60))
  console.log('🎉 Import complete!')
  console.log(`   ✅ Imported   : ${imported}`)
  console.log(`   ↷  Skipped    : ${skipped} (already in DB)`)
  console.log(`   ?  Not found  : ${notFound} (patient name not matched)`)
  console.log(`   ❌ Errors     : ${errors}`)

  if (notFoundNames.length > 0) {
    console.log(`\n⚠️  Unmatched patient names (${notFoundNames.length}):`)
    for (const name of notFoundNames.slice(0, 30)) console.log(`     - ${name}`)
    if (notFoundNames.length > 30) console.log(`     ... and ${notFoundNames.length - 30} more`)
    console.log('\n   Tip: Import patient data first, then re-run this script.')
  }

  if (errorList.length > 0) {
    console.log(`\n⚠️  First ${Math.min(errorList.length, 20)} errors:`)
    for (const e of errorList.slice(0, 20)) console.log(`     - ${e}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
