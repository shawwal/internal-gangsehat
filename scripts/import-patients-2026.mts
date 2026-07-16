/**
 * Import missing patients from data_migrations/DATA PASIEN 2026 - 🙎_♂️ Pasien (1).csv → patients table.
 * Run: npx tsx scripts/import-patients-2026.mts [--dry-run]
 *
 * Source: latest full roster export from the clinic's Google Sheet. Most rows already
 * exist in the DB from earlier migrations — this only inserts patients whose No. RM
 * (plaintext, matches patients.no_rm) or phone_hash isn't already present.
 */

import { createCipheriv, createHash, randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')

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

const CSV_PATH = join(__dirname, '../data_migrations/DATA PASIEN 2026 - 🙎_♂️ Pasien (1).csv')

const encKey = Buffer.from(ENCRYPTION_KEY, 'hex')

// ── Encrypt / hash helpers (matches lib/encryption.ts) ────────────────────────
function encrypt(text: string): string {
  const iv     = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', encKey, iv)
  const enc    = cipher.update(text, 'utf8', 'hex') + cipher.final('hex')
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc}`
}

function hashPhone(phone: string): string {
  const norm = phone.replace(/[\s\-\(\)\.\+]/g, '').replace(/^0/, '62')
  return createHash('sha256').update(norm).digest('hex')
}

function normalizeGender(raw: string): 'male' | 'female' | 'other' {
  const v = raw.trim().toLowerCase()
  if (['l', 'laki-laki', 'laki', 'male', 'm'].includes(v)) return 'male'
  if (['p', 'perempuan', 'female', 'f'].includes(v)) return 'female'
  return 'other'
}

function normalizeName(name: string): string {
  return name.toUpperCase().trim().replace(/\s+/g, ' ')
}

function parseBirthDate(dmy: string): string | null {
  const m = dmy.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function nullify(v: string | undefined): string | null {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

// Minimal RFC-4180 CSV parser (handles quoted fields with commas/newlines)
function parseCsv(raw: string): string[][] {
  const rows: string[][] = []
  let pos = 0

  function parseField(): string {
    if (raw[pos] === '"') {
      pos++
      let field = ''
      while (pos < raw.length) {
        if (raw[pos] === '"' && raw[pos + 1] === '"') { field += '"'; pos += 2 }
        else if (raw[pos] === '"') { pos++; break }
        else field += raw[pos++]
      }
      return field
    }
    let field = ''
    while (pos < raw.length && raw[pos] !== ',' && raw[pos] !== '\n' && raw[pos] !== '\r') {
      field += raw[pos++]
    }
    return field
  }

  function parseLine(): string[] {
    const fields: string[] = []
    while (pos < raw.length && raw[pos] !== '\n' && raw[pos] !== '\r') {
      fields.push(parseField())
      if (raw[pos] === ',') pos++
    }
    if (raw[pos] === '\r') pos++
    if (raw[pos] === '\n') pos++
    return fields
  }

  while (pos < raw.length) {
    rows.push(parseLine())
  }
  return rows
}

const PLACEHOLDERS = new Set(['OFF', 'LIBUR', 'TA', 'MANAJEMEN', 'KHUSUS', 'BELUM ISI DATA', ''])

type PatientCandidate = {
  name: string
  no_rm: string
  age: number | null
  birthDate: string | null
  gender: 'male' | 'female' | 'other'
  address: string | null
  kelurahan: string | null
  kecamatan: string | null
  kabupatenKota: string | null
  provinsi: string | null
  agama: string | null
  pekerjaan: string | null
  keluhan: string | null
  hobi: string | null
  phone: string
  hash: string
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ENCRYPTION_KEY) {
    console.error('❌ Missing env vars in .env')
    process.exit(1)
  }
  if (DRY_RUN) console.log('🧪 DRY RUN — no writes will be made\n')

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  console.log('📖 Reading DATA PASIEN 2026 CSV...')
  const raw = readFileSync(CSV_PATH, 'utf8')
  const rows = parseCsv(raw)
  const dataRows = rows.slice(6) // header spans first 6 lines
  console.log(`   ${dataRows.length} data rows found`)

  const candidates: PatientCandidate[] = []
  const seenRms = new Set<string>()

  for (const cols of dataRows) {
    if (cols.length < 8) continue
    const rawName = (cols[6] ?? '').trim()
    const no_rm   = (cols[7] ?? '').trim()

    if (PLACEHOLDERS.has(no_rm) || PLACEHOLDERS.has(rawName)) continue
    if (!no_rm) continue
    if (seenRms.has(no_rm)) continue // dedupe duplicate rows within the sheet
    seenRms.add(no_rm)

    const name = normalizeName(rawName)
    if (!name) continue

    const ageRaw = parseInt(cols[8] ?? '', 10)
    const age    = ageRaw > 0 && ageRaw < 120 ? ageRaw : null
    const phone  = (cols[21] ?? '').trim().replace(/[\s\-\(\)\.\+]/g, '')

    candidates.push({
      name,
      no_rm,
      age,
      birthDate:     parseBirthDate(cols[10] ?? ''),
      gender:        normalizeGender(cols[11] ?? ''),
      address:       nullify(cols[12]),
      kelurahan:     nullify(cols[13]),
      kecamatan:     nullify(cols[14]),
      kabupatenKota: nullify(cols[15]),
      provinsi:      nullify(cols[16]),
      agama:         nullify(cols[17]),
      pekerjaan:     nullify(cols[18]),
      keluhan:       nullify(cols[19]),
      hobi:          nullify(cols[20]),
      phone,
      hash:          phone ? hashPhone(phone) : '',
    })
  }
  console.log(`   ${candidates.length} candidates after filtering/dedup`)

  // Load existing no_rm + phone_hash from DB for deduplication
  console.log('\n🔍 Loading existing patient identifiers from DB...')
  const existingRms    = new Set<string>()
  const existingHashes = new Set<string>()

  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('patients')
      .select('phone_hash, no_rm')
      .range(from, from + PAGE - 1)
    if (error) { console.error('   Error:', error.message); break }
    if (!data?.length) break
    for (const r of data) {
      if (r.phone_hash) existingHashes.add(r.phone_hash)
      if (r.no_rm)      existingRms.add(r.no_rm)
    }
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`   ${existingRms.size} RM numbers, ${existingHashes.size} phone hashes in DB`)

  // Insert
  console.log(`\n${DRY_RUN ? '🧪 Simulating' : '⬆️  Importing'} patients...\n`)
  let imported = 0
  let skipped  = 0
  let errors   = 0
  const errorList: string[] = []
  const skippedList: string[] = []
  const importedList: string[] = []

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]

    if (existingRms.has(c.no_rm)) {
      skipped++
      skippedList.push(`${c.name} (RM ${c.no_rm} already exists)`)
      process.stdout.write(`\r   [${i + 1}/${candidates.length}] ✅ ${imported}  ↷ ${skipped}  ❌ ${errors}`)
      continue
    }
    if (c.hash && existingHashes.has(c.hash)) {
      skipped++
      skippedList.push(`${c.name} (phone already exists)`)
      process.stdout.write(`\r   [${i + 1}/${candidates.length}] ✅ ${imported}  ↷ ${skipped}  ❌ ${errors}`)
      continue
    }

    if (DRY_RUN) {
      imported++
      importedList.push(`${c.name} (${c.no_rm}, ${c.phone || 'no phone'})`)
      existingRms.add(c.no_rm)
      if (c.hash) existingHashes.add(c.hash)
      process.stdout.write(`\r   [${i + 1}/${candidates.length}] ✅ ${imported}  ↷ ${skipped}  ❌ ${errors}`)
      continue
    }

    const { error } = await supabase.from('patients').insert({
      encrypted_name:       encrypt(c.name),
      encrypted_phone:      encrypt(c.phone || '-'), // encrypted_phone is NOT NULL; some legacy rows have no No. WA
      encrypted_address:    c.address ? encrypt(c.address) : null,
      encrypted_birth_date: c.birthDate ? encrypt(c.birthDate) : null,
      gender:               c.gender,
      no_rm:                c.no_rm,
      pekerjaan:            c.pekerjaan,
      agama:                c.agama,
      hobi:                 c.hobi,
      kelurahan:            c.kelurahan,
      kecamatan:            c.kecamatan,
      kabupaten_kota:       c.kabupatenKota,
      provinsi:             c.provinsi,
      keluhan:              c.keluhan,
      last_booking_age:     c.age,
      phone_hash:           c.hash || null,
      name_normalized:      c.name.toLowerCase().trim(),
      is_active:            true,
    })

    if (error) {
      errors++
      errorList.push(`${c.name} (${c.no_rm}): ${error.message}`)
    } else {
      imported++
      existingRms.add(c.no_rm)
      if (c.hash) existingHashes.add(c.hash)
    }

    process.stdout.write(`\r   [${i + 1}/${candidates.length}] ✅ ${imported}  ↷ ${skipped}  ❌ ${errors}`)
  }

  console.log('\n\n' + '─'.repeat(55))
  console.log(DRY_RUN ? '🧪 Dry run complete!' : '🎉 Import complete!')
  console.log(`   ✅ ${DRY_RUN ? 'Would import' : 'Imported'} : ${imported}`)
  console.log(`   ↷  Skipped     : ${skipped}`)
  console.log(`   ❌ Errors      : ${errors}`)

  if (DRY_RUN && importedList.length > 0) {
    console.log('\n📋 Would import:')
    for (const s of importedList) console.log(`   - ${s}`)
  }
  if (skippedList.length > 0 && skippedList.length <= 30) {
    console.log('\n⚠️  Skipped:')
    for (const s of skippedList) console.log(`   - ${s}`)
  }
  if (errorList.length > 0) {
    console.log('\n⚠️  Errors:')
    for (const e of errorList) console.log(`   - ${e}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
