/**
 * Export unmatched patients from orders_paket.json → data_migrations/unmatched_patients.xlsx
 * Run: npx tsx scripts/export-unmatched-patients.mts
 *
 * Identifies orders whose patient name doesn't match any record in the patients table
 * and whose KODE hasn't been imported yet. Outputs an Excel file for admin review.
 */

import * as XLSX from 'xlsx'
import { createDecipheriv } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
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

const PAKET_PATH  = join(__dirname, '../data_migrations/orders_paket.json')
const OUTPUT_XLSX = join(__dirname, '../data_migrations/unmatched_patients.xlsx')
const OUTPUT_CSV  = join(__dirname, '../data_migrations/unmatched_patients.csv')

// ── Decrypt helper ────────────────────────────────────────────────────────────
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // 1. Decrypt all patient names from DB
  console.log('🔓 Loading + decrypting patient names from DB...')
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

  // 2. Load already-imported KODEs from patient_packages.notes
  console.log('\n📦 Loading already-imported KODEs...')
  const importedKodes = new Set<string>()
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
        const m = p.notes.match(/TRX\/\d{4}\/\d{2}\/\d{4}/)
        if (m) importedKodes.add(m[0])
      }
    }
    if (data.length < PKG_PAGE) break
    pkgFrom += PKG_PAGE
  }
  console.log(`   ${importedKodes.size} already imported`)

  // 3. Load orders and find unmatched
  console.log('\n📖 Reading orders_paket.json...')
  type PaketOrder = Record<string, string>
  const orders: PaketOrder[] = JSON.parse(readFileSync(PAKET_PATH, 'utf8'))
  console.log(`   ${orders.length} orders found`)

  const unmatched: PaketOrder[] = []
  for (const o of orders) {
    const kode   = (o.KODE ?? '').trim()
    const pasien = normalizeName(o.PASIEN ?? '')
    if (importedKodes.has(kode)) continue          // already in DB
    if (nameToId.has(pasien)) continue             // patient found → would be imported
    unmatched.push(o)
  }
  console.log(`   ${unmatched.length} unmatched patients found`)

  if (unmatched.length === 0) {
    console.log('\n✅ No unmatched patients — nothing to export.')
    return
  }

  // 4. Build sheet data
  const headers = [
    'NO', 'KODE', 'NAMA PASIEN', 'LAYANAN', 'STATUS',
    'TOTAL SESI', 'PERTEMUAN TERAKHIR', 'PERTEMUAN SELANJUTNYA', 'ADMIN', 'CATATAN',
  ]

  const rows = unmatched.map((o, idx) => [
    idx + 1,
    o.KODE ?? '',
    o.PASIEN ?? '',
    o.LAYANAN ?? '',
    o.STATUS ?? '',
    o['TOTAL PERTEMUAN'] ?? '',
    o['PERTEMUAN TERAKHIR'] ?? '',
    o['PERTEMUAN SELANJUTNYA'] ?? '',
    o.ADMIN ?? '',
    '',  // CATATAN — blank for admin
  ])

  const sheetData = [headers, ...rows]

  // 5. Write Excel
  const wb  = XLSX.utils.book_new()
  const ws  = XLSX.utils.aoa_to_sheet(sheetData)

  // Auto-width columns
  const colWidths = headers.map((h, ci) => ({
    wch: Math.max(h.length, ...rows.map((r) => String(r[ci] ?? '').length)) + 2,
  }))
  ws['!cols'] = colWidths

  XLSX.utils.book_append_sheet(wb, ws, 'Pasien Belum Terdaftar')
  XLSX.writeFile(wb, OUTPUT_XLSX)
  console.log(`\n✅ Excel written: ${OUTPUT_XLSX}`)

  // 6. Write CSV fallback
  const csvLines = sheetData.map((row) =>
    row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
  )
  writeFileSync(OUTPUT_CSV, csvLines.join('\n'), 'utf8')
  console.log(`✅ CSV written:   ${OUTPUT_CSV}`)

  console.log(`\n📋 Summary: ${unmatched.length} patients need to be registered in the system`)
}

main().catch((e) => { console.error(e); process.exit(1) })
