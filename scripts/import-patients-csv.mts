/**
 * Upsert patients from data_migrations/patients_rows.csv → patients table.
 * Run: npx tsx scripts/import-patients-csv.mts
 *
 * CSV columns match the patients table exactly (id, encrypted_name, etc.).
 * Uses upsert on id so it's safe to re-run.
 */

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

const CSV_PATH = join(__dirname, '../data_migrations/patients_rows.csv')
const BATCH    = 100

// Convert empty strings to null for nullable columns
function clean(val: string | undefined): string | null {
  return !val || val === '' ? null : val
}

// Minimal RFC-4180 CSV parser (handles quoted fields with commas/newlines)
function parseCsv(raw: string): Record<string, string>[] {
  const results: Record<string, string>[] = []
  let pos = 0

  function parseField(): string {
    if (raw[pos] === '"') {
      pos++ // skip opening quote
      let field = ''
      while (pos < raw.length) {
        if (raw[pos] === '"' && raw[pos + 1] === '"') {
          field += '"'; pos += 2
        } else if (raw[pos] === '"') {
          pos++; break
        } else {
          field += raw[pos++]
        }
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

  const headers = parseLine()
  while (pos < raw.length) {
    // skip blank lines
    if (raw[pos] === '\r' || raw[pos] === '\n') { pos++; continue }
    const values = parseLine()
    if (values.length === 0 || (values.length === 1 && values[0] === '')) continue
    const obj: Record<string, string> = {}
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = values[i] ?? ''
    results.push(obj)
  }
  return results
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  console.log('📖 Reading patients_rows.csv...')
  const raw = readFileSync(CSV_PATH, 'utf8')
  const rows = parseCsv(raw)
  console.log(`   ${rows.length} rows found`)

  // Map CSV row → patients table shape
  const records = rows.map((r) => ({
    id:                        r.id,
    profile_id:                clean(r.profile_id),
    encrypted_name:            r.encrypted_name,
    encrypted_phone:           r.encrypted_phone,
    encrypted_address:         clean(r.encrypted_address),
    encrypted_id_number:       clean(r.encrypted_id_number),
    encrypted_birth_date:      clean(r.encrypted_birth_date),
    encrypted_emergency_contact: clean(r.encrypted_emergency_contact),
    gender:                    clean(r.gender),
    blood_type:                clean(r.blood_type),
    allergies:                 clean(r.allergies) ? r.allergies.replace(/^{|}$/g, '').split(',').filter(Boolean) : [],
    medical_notes:             clean(r.medical_notes),
    is_active:                 r.is_active === 'true',
    created_at:                r.created_at || new Date().toISOString(),
    updated_at:                r.updated_at || new Date().toISOString(),
    member_type_id:            clean(r.member_type_id) ? parseInt(r.member_type_id, 10) : null,
    last_booking_city:         clean(r.last_booking_city),
    last_location_lat:         clean(r.last_location_lat) ? parseFloat(r.last_location_lat) : null,
    last_location_lng:         clean(r.last_location_lng) ? parseFloat(r.last_location_lng) : null,
    last_booking_age:          clean(r.last_booking_age) ? parseInt(r.last_booking_age, 10) : null,
    no_rm:                     clean(r.no_rm),
    pekerjaan:                 clean(r.pekerjaan),
    agama:                     clean(r.agama),
    hobi:                      clean(r.hobi),
    kelurahan:                 clean(r.kelurahan),
    kecamatan:                 clean(r.kecamatan),
    kabupaten_kota:            clean(r.kabupaten_kota),
    provinsi:                  clean(r.provinsi),
    phone_hash:                clean(r.phone_hash),
    name_normalized:           clean(r.name_normalized),
    keluhan:                   clean(r.keluhan),
  }))

  console.log('\n⬆️  Upserting in batches...\n')
  let upserted = 0
  let errors   = 0
  const errorList: string[] = []

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH)
    const { error } = await supabase
      .from('patients')
      .upsert(batch, { onConflict: 'id' })

    if (error) {
      errors++
      errorList.push(`batch ${i / BATCH + 1}: ${error.message}`)
    } else {
      upserted += batch.length
    }

    process.stdout.write(`\r   ${upserted} upserted  ❌ ${errors} batch errors`)
  }

  console.log('\n\n' + '─'.repeat(50))
  console.log('🎉 Import complete!')
  console.log(`   ✅ Upserted : ${upserted}`)
  console.log(`   ❌ Errors   : ${errors}`)
  if (errorList.length > 0) {
    console.log('\n⚠️  Errors:')
    for (const e of errorList) console.log(`   - ${e}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
