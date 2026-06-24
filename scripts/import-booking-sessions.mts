/**
 * Import session data from orders_medical_records.json → booking_sessions table.
 * Run: npx tsx scripts/import-booking-sessions.mts
 *
 * Source: data_migrations/orders_medical_records.json (7,455 rows, one row per session)
 *
 * Requires import-orders.mts to have run first (booking_id looked up via internal_order_meta.kode_transaksi).
 *
 * Strategy:
 *  1. Read JSON, group rows by KODE
 *  2. Load kode_transaksi → booking_id map from internal_order_meta
 *  3. Load existing booking_ids in booking_sessions (idempotency — skip whole booking if already imported)
 *  4. For each KODE: sort sessions by date, assign session_number 1,2,3..., insert rows
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

const JSON_PATH = join(__dirname, '../data_migrations/orders_medical_records.json')

// ── Helpers ───────────────────────────────────────────────────────────────────

// Parse "24-06-2026" (DD-MM-YYYY) → "2026-06-24"; returns null for "-" or sentinel dates
function parseDate(val: string | null | undefined): string | null {
  if (!val || val === '-') return null
  const parts = String(val).split('-')
  if (parts.length !== 3) return null
  const [dd, mm, yyyy] = parts
  if (yyyy === '1970') return null   // sentinel "01-01-1970"
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

// Parse "Rp75.000" → 75000; returns 0 for "-" or empty
function parseRupiah(val: string | null | undefined): number {
  if (!val || val === '-') return 0
  return parseInt(String(val).replace(/[^0-9]/g, ''), 10) || 0
}

// Map SESSION_STATUS from old system to booking_sessions.status enum values
function mapStatus(raw: string): string {
  const s = (raw ?? '').trim()
  if (s === 'Hadir')           return 'Hadir'
  if (s === 'Tidak Hadir')     return 'Tidak Hadir'
  if (s === 'Batal')           return 'Batal'
  return 'Belum Ditangani'
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface MedicalRecord {
  orderId:          string
  KODE:             string
  PASIEN:           string
  SISA_PERTEMUAN:   string
  TOTAL_PERTEMUAN:  string
  SESSION_NO:       string
  SESSION_TANGGAL:  string
  SESSION_JAM:      string
  SESSION_FISIO:    string
  SESSION_STATUS:   string
  SESSION_NOMINAL:  string
  SESSION_KETERANGAN: string
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // 1. Load JSON
  console.log('📖 Reading medical records JSON...')
  const records: MedicalRecord[] = JSON.parse(readFileSync(JSON_PATH, 'utf8'))
  console.log(`   ${records.length} session rows found`)

  // 2. Group by KODE
  console.log('\n🗂  Grouping by KODE...')
  const byKode = new Map<string, MedicalRecord[]>()
  for (const r of records) {
    const kode = (r.KODE ?? '').trim()
    if (!kode) continue
    if (!byKode.has(kode)) byKode.set(kode, [])
    byKode.get(kode)!.push(r)
  }
  console.log(`   ${byKode.size} unique orders found`)

  // 3. Load kode_transaksi → booking_id from internal_order_meta
  console.log('\n🔍 Loading order codes from internal_order_meta...')
  const kodeToBookingId = new Map<string, string>()
  let metaFrom = 0
  const META_PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('internal_order_meta')
      .select('kode_transaksi, booking_id')
      .range(metaFrom, metaFrom + META_PAGE - 1)
    if (error) { console.error('   Error:', error.message); break }
    if (!data?.length) break
    for (const r of data) kodeToBookingId.set(r.kode_transaksi, r.booking_id)
    if (data.length < META_PAGE) break
    metaFrom += META_PAGE
  }
  console.log(`   ${kodeToBookingId.size} booking codes loaded from DB`)

  // 4. Load existing booking_ids in booking_sessions (idempotency)
  console.log('\n📦 Loading existing booking_sessions...')
  const existingBookingIds = new Set<string>()
  let sessFrom = 0
  const SESS_PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('booking_sessions')
      .select('booking_id')
      .range(sessFrom, sessFrom + SESS_PAGE - 1)
    if (error) { console.error('   Error:', error.message); break }
    if (!data?.length) break
    for (const r of data) existingBookingIds.add(r.booking_id)
    if (data.length < SESS_PAGE) break
    sessFrom += SESS_PAGE
  }
  console.log(`   ${existingBookingIds.size} bookings already have sessions (will be skipped)`)

  // 5. Import sessions order by order
  console.log('\n⬆️  Importing sessions...\n')
  let imported     = 0
  let skippedExist = 0
  let skippedNoMatch = 0
  let errors       = 0
  const errorList: string[] = []

  const kodes = Array.from(byKode.keys())

  for (let i = 0; i < kodes.length; i++) {
    const kode      = kodes[i]
    const bookingId = kodeToBookingId.get(kode)

    if (!bookingId) {
      skippedNoMatch++
      process.stdout.write(`\r   [${i + 1}/${kodes.length}] ✅ ${imported}  ↷ exist:${skippedExist} no-match:${skippedNoMatch}  ❌ ${errors}`)
      continue
    }

    if (existingBookingIds.has(bookingId)) {
      skippedExist++
      process.stdout.write(`\r   [${i + 1}/${kodes.length}] ✅ ${imported}  ↷ exist:${skippedExist} no-match:${skippedNoMatch}  ❌ ${errors}`)
      continue
    }

    const sessions = byKode.get(kode)!

    // Sort sessions by date ascending; unknowns go last
    sessions.sort((a, b) => {
      const da = parseDate(a.SESSION_TANGGAL)
      const db = parseDate(b.SESSION_TANGGAL)
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return da.localeCompare(db)
    })

    // Build insert rows with sequential session numbers
    const rows = sessions.map((s, idx) => {
      const tanggal   = parseDate(s.SESSION_TANGGAL)
      const jam       = (s.SESSION_JAM && s.SESSION_JAM !== '-') ? s.SESSION_JAM : null
      const fisio     = (s.SESSION_FISIO && s.SESSION_FISIO !== '-') ? s.SESSION_FISIO.trim() : null
      const keterangan = (s.SESSION_KETERANGAN && s.SESSION_KETERANGAN !== '-')
        ? s.SESSION_KETERANGAN.trim() : null
      const nominal   = parseRupiah(s.SESSION_NOMINAL)

      return {
        booking_id:       bookingId,
        session_number:   idx + 1,
        tanggal:          tanggal ?? undefined,
        jam:              jam ?? undefined,
        therapist_id:     null,
        status:           mapStatus(s.SESSION_STATUS),
        nominal_bayar:    nominal,
        keterangan:       keterangan ?? undefined,
        catatan_admin:    fisio ? `FISIO: ${fisio}` : undefined,
        wa_order_count:   0,
        wa_reminder_count: 0,
      }
    })

    // Insert in one batch per booking
    const { error: insertErr } = await supabase
      .from('booking_sessions')
      .insert(rows)

    if (insertErr) {
      errors++
      errorList.push(`${kode}: ${insertErr.message}`)
    } else {
      imported += rows.length
      existingBookingIds.add(bookingId)
    }

    process.stdout.write(`\r   [${i + 1}/${kodes.length}] ✅ ${imported} rows  ↷ exist:${skippedExist} no-match:${skippedNoMatch}  ❌ ${errors}`)
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n\n' + '─'.repeat(60))
  console.log('🎉 Import complete!')
  console.log(`   ✅ Session rows imported : ${imported}`)
  console.log(`   ↷  Skipped (existing)   : ${skippedExist} orders`)
  console.log(`   ↷  Skipped (no booking) : ${skippedNoMatch} orders (run import-orders.mts first)`)
  console.log(`   ❌ Errors               : ${errors}`)

  if (errorList.length > 0) {
    console.log(`\n⚠️  First ${Math.min(errorList.length, 20)} errors:`)
    for (const e of errorList.slice(0, 20)) console.log(`     - ${e}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
