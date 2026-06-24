/**
 * Import missing patients from data_migrations/patients_complete.csv → patients table.
 * Run: npx tsx scripts/import-patients-complete.mts
 *
 * Source: patients_complete.csv — columns: (gender selector), Nama, Kode/RM, Umur, Jenis Kelamin, Nomor HP
 * Only imports patients from unmatched_patients.csv (those not yet in the DB).
 *
 * Strategy:
 *  1. Load the 57 unmatched names from unmatched_patients.csv
 *  2. Read patients_complete.csv, filter to only those names
 *  3. Deduplicate by phone_hash and no_rm against existing DB records
 *  4. Encrypt name + phone, hash phone, insert
 */

import { createCipheriv, createHash, randomBytes } from 'crypto'
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

const COMPLETE_PATH   = join(__dirname, '../data_migrations/patients_complete.csv')
const UNMATCHED_PATH  = join(__dirname, '../data_migrations/unmatched_patients.csv')

const encKey = Buffer.from(ENCRYPTION_KEY, 'hex')

// ── Encrypt / hash helpers ────────────────────────────────────────────────────
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

// Parse a simple CSV line that has quoted fields (all fields quoted with "")
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ENCRYPTION_KEY) {
    console.error('❌ Missing env vars in .env')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // 1. Load unmatched names from unmatched_patients.csv
  console.log('📖 Loading unmatched names...')
  const unmatchedRaw  = readFileSync(UNMATCHED_PATH, 'utf8')
  const unmatchedLines = unmatchedRaw.trim().split('\n').slice(1)
  const unmatchedNames = new Set(
    unmatchedLines.map(line => {
      const parts = line.split('","')
      return normalizeName(parts[2] ?? '')
    })
  )
  console.log(`   ${unmatchedNames.size} unmatched patient names loaded`)

  // 2. Read patients_complete.csv
  // Header spans 3 lines (multi-line first column), data starts at line 4
  console.log('\n📖 Reading patients_complete.csv...')
  const completeRaw   = readFileSync(COMPLETE_PATH, 'utf8')
  const completeLines = completeRaw.split('\n')

  // Find where data starts: first line where col[1] matches a name in unmatchedNames
  // The header is 3 lines (the first col is multi-line quoted)
  // Safe to skip first 3 lines
  const dataLines = completeLines.slice(3).filter(l => l.trim())

  type PatientCandidate = {
    name:    string
    no_rm:   string
    age:     number | null
    gender:  'male' | 'female' | 'other'
    phone:   string
    hash:    string
  }

  const candidates: PatientCandidate[] = []
  const seenNames = new Set<string>()

  for (const line of dataLines) {
    const cols   = parseCsvLine(line.trim())
    // cols: [gender-selector(empty), Nama, Kode/RM, Umur, Jenis Kelamin, Nomor HP]
    const name   = normalizeName(cols[1] ?? '')
    const no_rm  = (cols[2] ?? '').trim()
    const ageRaw = parseInt(cols[3] ?? '0', 10)
    const gender = normalizeGender(cols[4] ?? '')
    const phone  = (cols[5] ?? '').trim().replace(/[\s\-\(\)\.\+]/g, '')

    if (!name || !phone) continue
    if (!unmatchedNames.has(name)) continue  // only import the 57 missing ones
    if (seenNames.has(name)) continue        // deduplicate within file
    seenNames.add(name)

    const age = ageRaw > 0 && ageRaw < 120 ? ageRaw : null

    candidates.push({ name, no_rm, age, gender, phone, hash: hashPhone(phone) })
  }
  console.log(`   ${candidates.length} candidates to import`)

  // 3. Load existing phone_hashes and no_rms from DB for deduplication
  console.log('\n🔍 Loading existing patient identifiers from DB...')
  const existingHashes = new Set<string>()
  const existingRms    = new Set<string>()

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
  console.log(`   ${existingHashes.size} phone hashes, ${existingRms.size} RM numbers in DB`)

  // 4. Insert
  console.log('\n⬆️  Importing patients...\n')
  let imported  = 0
  let skipped   = 0
  let errors    = 0
  const errorList: string[] = []
  const skippedList: string[] = []

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]

    if (existingHashes.has(c.hash)) {
      skipped++
      skippedList.push(`${c.name} (phone already exists)`)
      process.stdout.write(`\r   [${i + 1}/${candidates.length}] ✅ ${imported}  ↷ ${skipped}  ❌ ${errors}`)
      continue
    }
    if (c.no_rm && existingRms.has(c.no_rm)) {
      skipped++
      skippedList.push(`${c.name} (RM ${c.no_rm} already exists)`)
      process.stdout.write(`\r   [${i + 1}/${candidates.length}] ✅ ${imported}  ↷ ${skipped}  ❌ ${errors}`)
      continue
    }

    const { error } = await supabase.from('patients').insert({
      encrypted_name:  encrypt(c.name),
      encrypted_phone: encrypt(c.phone),
      gender:          c.gender,
      no_rm:           c.no_rm || null,
      last_booking_age: c.age,
      phone_hash:      c.hash,
      name_normalized: c.name.toLowerCase().trim(),
      is_active:       true,
    })

    if (error) {
      errors++
      errorList.push(`${c.name}: ${error.message}`)
    } else {
      imported++
      existingHashes.add(c.hash)
      if (c.no_rm) existingRms.add(c.no_rm)
    }

    process.stdout.write(`\r   [${i + 1}/${candidates.length}] ✅ ${imported}  ↷ ${skipped}  ❌ ${errors}`)
  }

  console.log('\n\n' + '─'.repeat(55))
  console.log('🎉 Import complete!')
  console.log(`   ✅ Imported : ${imported}`)
  console.log(`   ↷  Skipped  : ${skipped}`)
  console.log(`   ❌ Errors   : ${errors}`)

  if (skippedList.length > 0) {
    console.log('\n⚠️  Skipped:')
    for (const s of skippedList) console.log(`   - ${s}`)
  }
  if (errorList.length > 0) {
    console.log('\n⚠️  Errors:')
    for (const e of errorList) console.log(`   - ${e}`)
  }

  if (imported > 0) {
    console.log('\n💡 Next: re-run import-active-packages.mts to link packages to these patients.')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
