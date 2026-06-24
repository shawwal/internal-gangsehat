/**
 * Fix the 13 packages whose patient name didn't match the DB name.
 * Uses phone-hash lookup via patients_complete.csv instead of name matching.
 * Run: npx tsx scripts/import-packages-by-phone.mts
 */

import { createDecipheriv, createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
const COMPLETE_PATH = join(__dirname, '../data_migrations/patients_complete.csv')

const encKey = Buffer.from(ENCRYPTION_KEY, 'hex')

function decrypt(text: string): string {
  if (!text) return ''
  const parts = text.split(':')
  if (parts.length !== 3 || parts[0].length !== 32 || parts[1].length !== 32) return text
  try {
    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const decipher = createDecipheriv('aes-256-gcm', encKey, iv)
    decipher.setAuthTag(authTag)
    return decipher.update(parts[2], 'hex', 'utf8') + decipher.final('utf8')
  } catch { return text }
}

function hashPhone(phone: string): string {
  const norm = phone.replace(/[\s\-\(\)\.\+]/g, '').replace(/^0/, '62')
  return createHash('sha256').update(norm).digest('hex')
}

function normalizeName(name: string): string {
  return name.toUpperCase().trim().replace(/\s+/g, ' ')
}

function parseDate(val: string | null | undefined): string | null {
  if (!val || val === '-') return null
  const parts = String(val).split('-')
  if (parts.length !== 3) return null
  const [dd, mm, yyyy] = parts
  if (yyyy === '1970') return null
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

function parseSessions(val: string | null | undefined): number {
  if (!val) return 1
  const n = parseInt(String(val).replace(/[^0-9]/g, ''), 10)
  return n > 0 ? n : 1
}

function mapPackage(layanan: string, totalFromData: number) {
  const l = layanan.toUpperCase().trim()
  if (l === 'PAKET 1' || l === 'PAKET SILVER')
    return { package_name: layanan, jenis_paket: 'P1' as const, total_sessions: Math.max(totalFromData, 5) }
  if (l === 'PAKET 2' || l === 'PAKET GOLD')
    return { package_name: layanan, jenis_paket: 'P2' as const, total_sessions: Math.max(totalFromData, 10) }
  if (l === 'PAKET PLATINUM')
    return { package_name: layanan, jenis_paket: null, total_sessions: Math.max(totalFromData, 20) }
  return { package_name: layanan, jenis_paket: null, total_sessions: totalFromData }
}

function mapOperationalStatus(status: string): 'ON' | 'PENDING' | 'OFF' {
  if (status === 'Proses') return 'ON'
  if (status === 'Booking') return 'PENDING'
  return 'OFF'
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      i++
      let field = ''
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { field += '"'; i += 2 }
        else if (line[i] === '"') { i++; break }
        else field += line[i++]
      }
      fields.push(field)
    } else {
      let field = ''
      while (i < line.length && line[i] !== ',') field += line[i++]
      fields.push(field)
    }
    if (line[i] === ',') i++
  }
  return fields
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // 1. Build KODE → Hadir session dates
  console.log('📖 Reading medical records...')
  type MedRecord = { KODE: string; SESSION_TANGGAL: string; SESSION_STATUS: string }
  const medRecords: MedRecord[] = JSON.parse(readFileSync(MEDICAL_PATH, 'utf8'))
  const kodeToHadirDates = new Map<string, string[]>()
  for (const r of medRecords) {
    const kode = (r.KODE ?? '').trim()
    if (!kode || (r.SESSION_STATUS ?? '').trim() !== 'Hadir') continue
    const d = parseDate(r.SESSION_TANGGAL)
    if (!d) continue
    if (!kodeToHadirDates.has(kode)) kodeToHadirDates.set(kode, [])
    kodeToHadirDates.get(kode)!.push(d)
  }
  for (const [, dates] of kodeToHadirDates) dates.sort()
  console.log(`   ${kodeToHadirDates.size} orders with Hadir sessions`)

  // 2. Load orders_paket.json
  type PaketOrder = {
    KODE: string; PASIEN: string; LAYANAN: string; STATUS: string
    'TOTAL PERTEMUAN': string; 'PERTEMUAN TERAKHIR': string; 'PERTEMUAN SELANJUTNYA': string
  }
  const paketOrders: PaketOrder[] = JSON.parse(readFileSync(PAKET_PATH, 'utf8'))

  // 3. Load existing KODEs to skip already-imported ones
  console.log('\n📦 Loading existing KODEs...')
  const existingKodes = new Set<string>()
  let pkgFrom = 0
  while (true) {
    const { data } = await supabase.from('patient_packages').select('notes').range(pkgFrom, pkgFrom + 499)
    if (!data?.length) break
    for (const p of data as { notes: string | null }[]) {
      const m = p.notes?.match(/TRX\/\d{4}\/\d{2}\/\d{4}/)
      if (m) existingKodes.add(m[0])
    }
    if (data.length < 500) break
    pkgFrom += 500
  }
  console.log(`   ${existingKodes.size} already imported`)

  // 4. Build name→phone map from patients_complete.csv (skip 3-line header)
  console.log('\n📖 Building name→phone from patients_complete.csv...')
  const completeLines = readFileSync(COMPLETE_PATH, 'utf8').split('\n').slice(3).filter(l => l.trim())
  const nameToPhone = new Map<string, string>()
  for (const line of completeLines) {
    const cols  = parseCsvLine(line.trim())
    const name  = normalizeName(cols[1] ?? '')
    const phone = (cols[5] ?? '').trim().replace(/[\s\-\(\)\.\+]/g, '')
    if (name && phone) nameToPhone.set(name, phone)
  }
  console.log(`   ${nameToPhone.size} entries`)

  // 5. Load all patients' phone_hash→id from DB
  console.log('\n🔓 Loading patient phone_hashes from DB...')
  const hashToId = new Map<string, string>()
  let patFrom = 0
  while (true) {
    const { data } = await supabase.from('patients').select('id, phone_hash').range(patFrom, patFrom + 999)
    if (!data?.length) break
    for (const p of data) {
      if (p.phone_hash) hashToId.set(p.phone_hash, p.id)
    }
    if (data.length < 1000) break
    patFrom += 1000
  }
  console.log(`   ${hashToId.size} patients with phone hashes`)

  // 6. Also need name→id for patients that DO match (fallback)
  console.log('\n🔓 Loading patient names from DB (decrypt)...')
  const nameToId = new Map<string, string>()
  patFrom = 0
  while (true) {
    const { data } = await supabase.from('patients').select('id, encrypted_name').eq('is_active', true).range(patFrom, patFrom + 499)
    if (!data?.length) break
    for (const p of data) {
      if (!p.encrypted_name) continue
      try { nameToId.set(normalizeName(decrypt(p.encrypted_name)), p.id) } catch { /* skip */ }
    }
    if (data.length < 500) break
    patFrom += 500
  }
  console.log(`   ${nameToId.size} unique names`)

  // 7. Resolve branch
  const { data: branches } = await supabase.from('branches').select('id, name').eq('is_active', true).order('name')
  const branch = branches?.[0]
  if (!branch) { console.error('❌ No active branches'); process.exit(1) }
  console.log(`\n🏥 Branch: ${branch.name}`)

  // 8. Find the 13 unmatched orders and import using phone-hash lookup
  console.log('\n⬆️  Importing unmatched packages via phone lookup...\n')

  const unmatched = paketOrders.filter(o => {
    const kode   = (o.KODE ?? '').trim()
    const name   = normalizeName(o.PASIEN ?? '')
    return kode && !existingKodes.has(kode) && !nameToId.has(name)
  })

  console.log(`   ${unmatched.length} unmatched orders to process\n`)

  let imported = 0
  let notFound = 0
  let errors   = 0

  for (const o of unmatched) {
    const kode  = (o.KODE ?? '').trim()
    const name  = normalizeName(o.PASIEN ?? '')

    // Find phone from patients_complete.csv
    const phone = nameToPhone.get(name)
    if (!phone) {
      console.log(`   ❓ No phone found in CSV for: ${name}`)
      notFound++
      continue
    }

    // Find patient in DB by phone hash
    const hash      = hashPhone(phone)
    const patientId = hashToId.get(hash)
    if (!patientId) {
      console.log(`   ❓ No DB patient for phone hash of: ${name} (phone: ${phone})`)
      notFound++
      continue
    }

    // Build package row (same logic as import-active-packages.mts)
    const totalFromData = parseSessions(o['TOTAL PERTEMUAN'])
    const { package_name, jenis_paket, total_sessions } = mapPackage(o.LAYANAN ?? '', totalFromData)
    const operationalStatus = mapOperationalStatus(o.STATUS ?? '')
    const lastSessionDate   = parseDate(o['PERTEMUAN TERAKHIR'])

    const hadirDates = kodeToHadirDates.get(kode) ?? []
    const tDates: Record<string, string> = {}
    for (let n = 1; n <= 10; n++) {
      const d = hadirDates[n - 1]
      if (d) tDates[`t${n}`] = d
    }

    const createdAt = lastSessionDate
      ? new Date(lastSessionDate).toISOString()
      : new Date().toISOString()

    const { error } = await supabase.from('patient_packages').insert({
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

    if (error) {
      console.log(`   ❌ ${name} (${kode}): ${error.message}`)
      errors++
    } else {
      console.log(`   ✅ ${name} → matched via phone (${phone.slice(0, 6)}...) | ${package_name} | ${operationalStatus}`)
      existingKodes.add(kode)
      imported++
    }
  }

  console.log('\n' + '─'.repeat(55))
  console.log('🎉 Done!')
  console.log(`   ✅ Imported : ${imported}`)
  console.log(`   ❓ Not found: ${notFound}`)
  console.log(`   ❌ Errors  : ${errors}`)
  console.log(`\n   Total packages in DB: ~${360 + imported}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
