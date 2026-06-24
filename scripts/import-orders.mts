/**
 * Import orders from public/orders_fisiotherapy.json → bookings + internal_order_meta.
 * Run: npx tsx scripts/import-orders.mts
 *
 * Source: public/orders_fisiotherapy.json (scraped from dewasa.fisioterapigangsehat.id)
 *
 * Strategy:
 *  1. Load JSON, check existing kode_transaksi to skip duplicates (idempotent)
 *  2. Decrypt all patient names from DB → build name→id lookup
 *  3. Per order: match patient by name, insert booking, insert internal_order_meta
 *
 * Notes:
 *  - guest_name is always set to the plain PASIEN name (display on order page)
 *  - patient_id is set only when a name match is found (for relational queries)
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

const JSON_PATH = join(__dirname, '../public/orders_fisiotherapy.json')

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
      const decoded    = Buffer.from(text, 'base64').toString('utf8')
      const printable  = decoded.replace(/[^\x20-\x7E -￿]/g, '')
      if (printable.length >= decoded.length * 0.8) return decoded
    } catch { /* ignore */ }
    return text
  }
}

function normalizeName(name: string): string {
  return name.toUpperCase().trim().replace(/\s+/g, ' ')
}

// Parse "Rp750.000" or "Rp1.300.000" → 750000 / 1300000
function parseRupiah(val: string | undefined | null): number {
  if (!val) return 0
  return parseInt(String(val).replace(/[^0-9]/g, ''), 10) || 0
}

// Parse "24-06-2026" (DD-MM-YYYY) → "2026-06-24"
function parseDate(val: string | undefined | null): string {
  if (!val) return new Date().toISOString().split('T')[0]
  const parts = String(val).split('-')
  if (parts.length !== 3) return new Date().toISOString().split('T')[0]
  const [dd, mm, yyyy] = parts
  return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
}

function mapStatus(status: string): string {
  if (status === 'Booking') return 'waiting_confirmation'
  if (status === 'Proses')  return 'in_progress'
  if (status === 'Selesai') return 'completed'
  return 'waiting_confirmation'
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // 1. Load JSON
  console.log('📖 Reading orders JSON...')
  const orders: Record<string, string>[] = JSON.parse(readFileSync(JSON_PATH, 'utf8'))
  console.log(`   ${orders.length} orders found in file`)

  // 2. Load existing kode_transaksi for idempotency
  console.log('\n🔍 Checking existing orders in DB...')
  const existingCodes = new Set<string>()
  let codeFrom = 0
  const CODE_PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('internal_order_meta')
      .select('kode_transaksi')
      .range(codeFrom, codeFrom + CODE_PAGE - 1)
    if (error) { console.error('   Error:', error.message); break }
    if (!data?.length) break
    for (const r of data) existingCodes.add(r.kode_transaksi)
    if (data.length < CODE_PAGE) break
    codeFrom += CODE_PAGE
  }
  console.log(`   ${existingCodes.size} existing orders found (will be skipped)`)

  // 3. Build name → patient_id lookup (decrypt all patients)
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

  // 4. Insert orders
  console.log('\n⬆️  Importing orders...\n')
  let imported = 0
  let skipped  = 0
  let matched  = 0
  let guests   = 0
  let errors   = 0
  const errorList: string[] = []

  for (let i = 0; i < orders.length; i++) {
    const o    = orders[i]
    const kode = (o['KODE'] ?? '').trim()

    if (!kode || existingCodes.has(kode)) {
      skipped++
      process.stdout.write(`\r   [${i+1}/${orders.length}] ✅ ${imported}  ↷ ${skipped}  👤 ${matched}  👥 ${guests}  ❌ ${errors}`)
      continue
    }

    const pasien     = (o['PASIEN'] ?? '').trim()
    const patientId  = nameToId.get(normalizeName(pasien)) ?? null
    const harga      = parseRupiah(o['HARGA'])
    const diskon     = parseRupiah(o['DISKON'])
    const totalBayar = parseRupiah(o['TOTAL BAYAR'])
    const discountPct = (harga > 0 && o['POTONGAN'] === 'diskon')
      ? Math.round((diskon / harga) * 100)
      : 0
    const dateStr  = parseDate(o['DIBUAT TGL'])
    const status   = mapStatus(o['STATUS'] ?? '')
    const layanan  = (o['LAYANAN'] ?? '').trim() || 'LAINNYA'

    // Insert booking — always set guest_name for display (orders page can't decrypt PII)
    const { data: bookingData, error: bookingErr } = await supabase
      .from('bookings')
      .insert({
        patient_id:          patientId,
        guest_name:          pasien || null,
        service_type:        layanan,
        scheduled_date:      dateStr,
        scheduled_time:      '00:00',
        duration_minutes:    60,
        status,
        estimated_price:     harga,
        discounted_price:    totalBayar,
        discount_percentage: discountPct,
        created_at:          new Date(dateStr).toISOString(),
      })
      .select('id')
      .single()

    if (bookingErr || !bookingData) {
      errors++
      const msg = `${kode}: ${bookingErr?.message ?? 'no data returned'}`
      errorList.push(msg)
      process.stdout.write(`\r   [${i+1}/${orders.length}] ✅ ${imported}  ↷ ${skipped}  👤 ${matched}  👥 ${guests}  ❌ ${errors}`)
      continue
    }

    // Insert internal_order_meta
    const { error: metaErr } = await supabase
      .from('internal_order_meta')
      .insert({
        booking_id:     bookingData.id,
        kode_transaksi: kode,
        status_bayar:   (o['STATUS BAYAR'] ?? 'Belum Lunas').trim(),
      })

    if (metaErr) {
      errors++
      errorList.push(`meta ${kode}: ${metaErr.message}`)
    } else {
      imported++
      existingCodes.add(kode)
      if (patientId) matched++; else guests++
    }

    process.stdout.write(`\r   [${i+1}/${orders.length}] ✅ ${imported}  ↷ ${skipped}  👤 ${matched}  👥 ${guests}  ❌ ${errors}`)
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n\n' + '─'.repeat(55))
  console.log('🎉 Import complete!')
  console.log(`   ✅ Imported        : ${imported}`)
  console.log(`   ↷  Skipped         : ${skipped} (already in DB)`)
  console.log(`   👤 Patient matched  : ${matched}`)
  console.log(`   👥 Guest booking   : ${guests}`)
  console.log(`   ❌ Errors          : ${errors}`)

  if (errorList.length > 0) {
    console.log(`\n⚠️  First ${Math.min(errorList.length, 20)} errors:`)
    for (const e of errorList.slice(0, 20)) console.log(`     - ${e}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
