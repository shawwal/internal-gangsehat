/**
 * Direct import script: reads EX. DATA PELAYANAN 2025.xlsx → inserts into Supabase patients table.
 * Run: npx tsx scripts/import-patients.mts
 *
 * Strategy:
 *  1. Parse + deduplicate within Excel by phone_hash (keep first) and no_rm (keep first)
 *  2. Batch-fetch all existing phone_hashes and no_rms from DB
 *  3. Filter to only truly new records
 *  4. Insert in batches of 100 (no per-row checks needed)
 */

import * as XLSX from 'xlsx'
import { createHash, createCipheriv, randomBytes } from 'crypto'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local
const envRaw = readFileSync(join(__dirname, '../.env.local'), 'utf8')
const env: Record<string, string> = {}
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim()
}

const SUPABASE_URL     = env['NEXT_PUBLIC_SUPABASE_URL']      ?? ''
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY']     ?? ''
const ENCRYPTION_KEY   = env['ENCRYPTION_KEY']                ?? ''
const EXCEL_PATH       = join(__dirname, '../public/EX. DATA PELAYANAN 2025.xlsx')
const BATCH_SIZE       = 100

const encKey = Buffer.from(ENCRYPTION_KEY, 'hex')

function encrypt(text: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', encKey, iv)
  const enc = cipher.update(text, 'utf8', 'hex') + cipher.final('hex')
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc}`
}

function hashPhone(phone: string): string {
  const norm = phone.replace(/[\s\-\(\)\.\+]/g, '').replace(/^0/, '62')
  return createHash('sha256').update(norm).digest('hex')
}

const COL: Record<string, string[]> = {
  no_rm:          ['no.rm', 'no rm', 'nomer rm', 'nomor rm', 'no. rm'],
  name:           ['nama', 'name', 'nama pasien'],
  phone:          ['no. hp', 'no hp', 'nomer hp', 'nomor hp', 'hp', 'phone', 'telepon',
                   'no. hp/whatsapp', 'no. hp/wa', 'no. whatsapp', 'no. wa', 'whatsapp'],
  address:        ['alamat', 'address'],
  birthDate:      ['tgl lahir', 'tanggal lahir', 'birth date', 'birthdate'],
  gender:         ['jk', 'jenis kelamin', 'gender'],
  pekerjaan:      ['pekerjaan', 'occupation'],
  agama:          ['agama', 'religion'],
  hobi:           ['hobi', 'hobby', 'hobi/aktivitas sehari-hari', 'hobi/aktivitas'],
  kelurahan:      ['kelurahan', 'kelurahan/desa', 'kel./desa'],
  kecamatan:      ['kecamatan'],
  kabupaten_kota: ['kab/kota', 'kabupaten/kota', 'kabupaten kota', 'kab. kota', 'kab./kota'],
  provinsi:       ['provinsi', 'province'],
}

function buildHeaderMap(headers: string[]): Map<string, number> {
  const map = new Map<string, number>()
  headers.forEach((h, i) => {
    const norm = String(h ?? '').trim().toLowerCase()
    for (const [key, aliases] of Object.entries(COL)) {
      if (aliases.includes(norm) && !map.has(key)) map.set(key, i)
    }
  })
  return map
}

function cellStr(row: unknown[], idx: number | undefined): string {
  if (idx === undefined || row[idx] == null) return ''
  const v = row[idx]
  if (v instanceof Date) return v.toISOString().split('T')[0]
  return String(v).trim()
}

function normalizeGender(raw: string): 'male' | 'female' | 'other' {
  const v = raw.trim().toLowerCase()
  if (['l', 'laki-laki', 'laki', 'male', 'm'].includes(v)) return 'male'
  if (['p', 'perempuan', 'female', 'f'].includes(v)) return 'female'
  return 'other'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllExisting(supabase: SupabaseClient<any, any, any>, column: string): Promise<Set<string>> {
  const result = new Set<string>()
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await supabase
      .from('patients')
      .select(column)
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const row of data) {
      const v = row[column as keyof typeof row]
      if (v) result.add(String(v))
    }
    if (data.length < pageSize) break
    from += pageSize
  }
  return result
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  console.log('📖 Reading Excel...')
  const buffer = readFileSync(EXCEL_PATH)
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = wb.SheetNames.find((n: string) => n.toLowerCase().includes('pasien')) ?? wb.SheetNames[0]
  console.log(`📋 Sheet: "${sheetName}"`)

  const sheet = wb.Sheets[sheetName]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
  const headers = (rows[0] as string[]).map(h => String(h ?? ''))
  const hMap = buildHeaderMap(headers)

  // ── Step 1: Parse + deduplicate within Excel ──────────────────────────────
  console.log('🔍 Parsing rows...')
  type PatientRow = {
    hash: string
    no_rm: string | null
    record: Record<string, unknown>
  }

  const seenHashes = new Set<string>()
  const seenRms    = new Set<string>()
  const parsed: PatientRow[] = []
  let parseSkipped = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const name  = cellStr(row, hMap.get('name'))
    const phone = cellStr(row, hMap.get('phone'))
    if (!name || !phone || !/\d/.test(phone)) continue

    const hash = hashPhone(phone)
    if (seenHashes.has(hash)) { parseSkipped++; continue }
    seenHashes.add(hash)

    const no_rm = cellStr(row, hMap.get('no_rm')) || null
    if (no_rm) {
      if (seenRms.has(no_rm)) {
        // Keep the row but nullify the duplicate no_rm
      } else {
        seenRms.add(no_rm)
      }
    }

    const address   = cellStr(row, hMap.get('address'))   || undefined
    const birthDate = cellStr(row, hMap.get('birthDate')) || undefined
    const gender    = normalizeGender(cellStr(row, hMap.get('gender')))

    parsed.push({
      hash,
      no_rm: no_rm && seenRms.has(no_rm) ? no_rm : null,  // cleared if dup
      record: {
        encrypted_name:       encrypt(name),
        encrypted_phone:      encrypt(phone),
        encrypted_address:    address   ? encrypt(address)   : null,
        encrypted_birth_date: birthDate ? encrypt(birthDate) : null,
        phone_hash:           hash,
        gender,
        no_rm:          no_rm ?? null,
        pekerjaan:      cellStr(row, hMap.get('pekerjaan'))      || null,
        agama:          cellStr(row, hMap.get('agama'))          || null,
        hobi:           cellStr(row, hMap.get('hobi'))           || null,
        kelurahan:      cellStr(row, hMap.get('kelurahan'))      || null,
        kecamatan:      cellStr(row, hMap.get('kecamatan'))      || null,
        kabupaten_kota: cellStr(row, hMap.get('kabupaten_kota')) || null,
        provinsi:       cellStr(row, hMap.get('provinsi'))       || null,
      }
    })
  }

  console.log(`📊 Unique patients in Excel: ${parsed.length} (${parseSkipped} in-file dups removed)`)

  // ── Step 2: Fetch existing phone_hashes + no_rms from DB ─────────────────
  console.log('🔄 Fetching existing records from DB...')
  const [existingHashes, existingRms] = await Promise.all([
    fetchAllExisting(supabase, 'phone_hash'),
    fetchAllExisting(supabase, 'no_rm'),
  ])
  console.log(`   DB: ${existingHashes.size} existing phone hashes, ${existingRms.size} existing no_rms`)

  // ── Step 3: Filter to only new records ────────────────────────────────────
  const toInsert = parsed
    .filter(p => !existingHashes.has(p.hash))
    .map(p => {
      // Also clear no_rm if it conflicts with DB
      if (p.no_rm && existingRms.has(p.no_rm)) {
        return { ...p.record, no_rm: null }
      }
      return p.record
    })

  console.log(`✨ New records to insert: ${toInsert.length}`)

  if (toInsert.length === 0) {
    console.log('ℹ️  Nothing to import — all patients already exist.')
    return
  }

  // ── Step 4: Insert in batches ─────────────────────────────────────────────
  let imported = 0, errors = 0

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('patients').insert(batch)
    if (error) {
      console.error(`\n❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error.message}`)
      // Fallback: try row by row
      for (const rec of batch) {
        const { error: e2 } = await supabase.from('patients').insert([rec])
        if (e2) errors++
        else imported++
      }
    } else {
      imported += batch.length
    }
    process.stdout.write(`\r   Progress: ${Math.min(i + BATCH_SIZE, toInsert.length)}/${toInsert.length} | ✅ ${imported} | ❌ ${errors}  `)
  }

  console.log(`\n\n🎉 Done!`)
  console.log(`   Imported  : ${imported}`)
  console.log(`   Errors    : ${errors}`)
  console.log(`   Skipped   : ${parsed.length - toInsert.length + parseSkipped} (duplicates)`)
}

main().catch(e => { console.error(e); process.exit(1) })
