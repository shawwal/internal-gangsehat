/**
 * Import packages from CATATAN KEUANGAN FGS PTK 2026.xlsx → patient_packages table.
 * Run: npx tsx scripts/import-packages.mts
 *
 * Source: public/CATATAN KEUANGAN FGS PTK 2026.xlsx → sheet "⬇️ PEMASUKAN"
 * Filters: PEMBELIAN starting with K.PT - PAKET* or K.L - PAKET*
 *
 * Strategy:
 *  1. Parse PEMASUKAN sheet, filter package rows, deduplicate by patient+package_name
 *  2. Load all patients from DB, decrypt names → build name→id lookup map
 *  3. Load existing patient_packages to prevent duplicates
 *  4. Insert matched packages one by one with progress output
 */

import * as XLSX from 'xlsx'
import { createDecipheriv, createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Load env ────────────────────────────────────────────────────────────────
const envRaw = readFileSync(join(__dirname, '../.env'), 'utf8')
const env: Record<string, string> = {}
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim()
}

const SUPABASE_URL     = env['NEXT_PUBLIC_SUPABASE_URL']  ?? ''
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''
const ENCRYPTION_KEY   = env['ENCRYPTION_KEY']            ?? ''

const EXCEL_PATH = join(__dirname, '../public/CATATAN KEUANGAN FGS PTK 2026.xlsx')

// Branch for this file: Fisioterapi Gang Sehat Pontianak (FGS PTK)
const FGS_PTK_BRANCH_NAME = 'Fisioterapi Gang Sehat Pontianak'

// ── Decrypt helper (mirrors lib/encryption.ts) ───────────────────────────────
const encKey = Buffer.from(ENCRYPTION_KEY, 'hex')

function decrypt(text: string): string {
  if (!text) return ''
  const parts = text.split(':')
  if (parts.length !== 3) return text
  if (parts[0].length !== 32 || parts[1].length !== 32) return text
  try {
    const iv      = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const decipher = createDecipheriv('aes-256-gcm', encKey, iv)
    decipher.setAuthTag(authTag)
    return decipher.update(parts[2], 'hex', 'utf8') + decipher.final('utf8')
  } catch {
    // Legacy base64 fallback
    try {
      const decoded = Buffer.from(text, 'base64').toString('utf8')
      const printable = decoded.replace(/[^\x20-\x7E -￿]/g, '')
      if (printable.length >= decoded.length * 0.8) return decoded
    } catch { /* ignore */ }
    return text
  }
}

// ── Package type mapping ─────────────────────────────────────────────────────
const PACKAGE_MAP: Record<string, { package_name: string; jenis_paket: 'P1' | 'P2' | null; total_sessions: number }> = {
  'K.PT - PAKET 1':            { package_name: 'PAKET 1',            jenis_paket: 'P1',  total_sessions: 5  },
  'K.PT - PAKET 2':            { package_name: 'PAKET 2',            jenis_paket: 'P2',  total_sessions: 10 },
  'K.PT - PAKET SILVER':       { package_name: 'PAKET SILVER',       jenis_paket: null,  total_sessions: 5  },
  'K.PT - PAKET GOLD':         { package_name: 'PAKET GOLD',         jenis_paket: null,  total_sessions: 10 },
  'K.PT - PAKET PLATINUM':     { package_name: 'PAKET PLATINUM',     jenis_paket: null,  total_sessions: 20 },
  'K.PT - PAKET KHUSUS':       { package_name: 'PAKET KHUSUS',       jenis_paket: null,  total_sessions: 5  },
  'K.PT - PAKET PENYESUAIAN':  { package_name: 'PAKET PENYESUAIAN',  jenis_paket: null,  total_sessions: 5  },
  'K.L - PAKET GOLD':          { package_name: 'PAKET GOLD',         jenis_paket: null,  total_sessions: 10 },
  'K.L - PAKET SILVER':        { package_name: 'PAKET SILVER',       jenis_paket: null,  total_sessions: 5  },
  'STUDIO.SKOLIOSIS - PAKET SILVER': { package_name: 'PAKET SILVER SKOLIOSIS', jenis_paket: null, total_sessions: 5 },
}

function normalizeName(name: string): string {
  return name.toUpperCase().trim().replace(/\s+/g, ' ')
}

function excelSerialToIso(serial: number): string | null {
  if (!serial || isNaN(serial) || serial < 40000) return null
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().split('T')[0]
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // ── Resolve branch ─────────────────────────────────────────────────────────
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  const branch = branches?.find((b) =>
    b.name.toLowerCase().includes('pontianak') || b.name.toLowerCase().includes('ptk')
  ) ?? branches?.[0]

  if (!branch) {
    console.error('❌ No active branches found in database.')
    process.exit(1)
  }
  console.log(`🏥 Branch: ${branch.name} (${branch.id})`)

  // ── 1. Parse Excel ─────────────────────────────────────────────────────────
  console.log('\n📖 Reading Excel...')
  const buffer = readFileSync(EXCEL_PATH)
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })

  const sheetName = wb.SheetNames.find((n: string) => n.toLowerCase().includes('pemasukan')) ?? wb.SheetNames[0]
  console.log(`📋 Sheet: "${sheetName}"`)

  const sheet = wb.Sheets[sheetName]
  const rows: (string | number | boolean | null)[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })

  // Auto-detect header row (first row containing "NAMA PASIEN")
  let headerRowIdx = -1
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    if (rows[i]?.some((c) => String(c ?? '').toUpperCase().includes('NAMA PASIEN'))) {
      headerRowIdx = i
      break
    }
  }
  if (headerRowIdx === -1) {
    console.error('❌ Could not find header row with "NAMA PASIEN" in the first 15 rows.')
    process.exit(1)
  }

  const headers = rows[headerRowIdx].map((h) => String(h ?? '').toUpperCase().trim())
  const namaIdx      = headers.indexOf('NAMA PASIEN')
  const pembelianIdx = headers.indexOf('PEMBELIAN')
  const tanggalIdx   = headers.indexOf('TANGGAL')

  console.log(`   Header row: ${headerRowIdx} | NAMA PASIEN: col ${namaIdx} | PEMBELIAN: col ${pembelianIdx} | TANGGAL: col ${tanggalIdx}`)

  const dataRows = rows.slice(headerRowIdx + 1)

  // ── 2. Filter + deduplicate package rows ───────────────────────────────────
  console.log('\n🔍 Filtering package rows...')

  type Candidate = {
    rawName:       string
    package_name:  string
    jenis_paket:   'P1' | 'P2' | null
    total_sessions: number
    tanggal:       string | null
  }

  const seen = new Set<string>()
  const candidates: Candidate[] = []

  for (const row of dataRows) {
    if (!row) continue
    const rawNama      = String(row[namaIdx]      ?? '').trim()
    const rawPembelian = String(row[pembelianIdx] ?? '').trim()
    if (!rawNama || !rawPembelian) continue

    const pkg = PACKAGE_MAP[rawPembelian]
    if (!pkg) continue

    const key = normalizeName(rawNama) + '|' + pkg.package_name
    if (seen.has(key)) continue
    seen.add(key)

    const tanggal = tanggalIdx !== -1 ? excelSerialToIso(Number(row[tanggalIdx] ?? 0)) : null
    candidates.push({ rawName: rawNama, ...pkg, tanggal })
  }

  console.log(`   ${candidates.length} unique patient+package combinations found`)

  // Breakdown by package type
  const breakdown: Record<string, number> = {}
  for (const c of candidates) {
    breakdown[c.package_name] = (breakdown[c.package_name] ?? 0) + 1
  }
  for (const [name, count] of Object.entries(breakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${count.toString().padStart(3)}  ${name}`)
  }

  if (candidates.length === 0) {
    console.log('\nℹ️  No package rows found — nothing to import.')
    return
  }

  // ── 3. Build name → patient_id map (decrypt all patients) ─────────────────
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

    if (error) { console.error('   Error fetching patients:', error.message); break }
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
  console.log(`\r   ${nameToId.size} unique patient names loaded from ${totalPatients} records`)

  // ── 4. Load existing packages to prevent duplicates ────────────────────────
  console.log('\n📦 Checking existing packages in DB...')

  const existingPkgs = new Set<string>()
  let pkgFrom = 0
  const PKG_PAGE = 500

  while (true) {
    const { data, error } = await supabase
      .from('patient_packages')
      .select('patient_id, package_name')
      .range(pkgFrom, pkgFrom + PKG_PAGE - 1)

    if (error) { console.error('   Error fetching packages:', error.message); break }
    if (!data?.length) break
    for (const p of data as { patient_id: string; package_name: string }[]) {
      existingPkgs.add(`${p.patient_id}|${p.package_name}`)
    }
    if (data.length < PKG_PAGE) break
    pkgFrom += PKG_PAGE
  }
  console.log(`   ${existingPkgs.size} existing packages found`)

  // ── 5. Insert ──────────────────────────────────────────────────────────────
  console.log('\n⬆️  Importing packages...\n')

  let imported = 0
  let skipped  = 0
  let notFound = 0
  let errors   = 0
  const notFoundNames: string[] = []

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    const norm = normalizeName(c.rawName)
    const patientId = nameToId.get(norm)

    if (!patientId) {
      notFound++
      notFoundNames.push(c.rawName)
      process.stdout.write(`\r   [${i + 1}/${candidates.length}] ✅ ${imported}  ↷ ${skipped}  ? ${notFound}  ❌ ${errors}`)
      continue
    }

    const existKey = `${patientId}|${c.package_name}`
    if (existingPkgs.has(existKey)) {
      skipped++
      process.stdout.write(`\r   [${i + 1}/${candidates.length}] ✅ ${imported}  ↷ ${skipped}  ? ${notFound}  ❌ ${errors}`)
      continue
    }

    const { error: insertErr } = await supabase.from('patient_packages').insert({
      patient_id:         patientId,
      branch_id:          branch.id,
      package_name:       c.package_name,
      package_type:       'fixed',
      total_sessions:     c.total_sessions,
      jenis_paket:        c.jenis_paket,
      mulai_paket:        'NEW',
      operational_status: 'ON',
      status:             'active',
      created_at:         c.tanggal ? new Date(c.tanggal).toISOString() : new Date().toISOString(),
      updated_at:         new Date().toISOString(),
    })

    if (insertErr) {
      errors++
      console.error(`\n   ❌ Error for ${c.rawName} / ${c.package_name}: ${insertErr.message}`)
    } else {
      imported++
      existingPkgs.add(existKey)
    }

    process.stdout.write(`\r   [${i + 1}/${candidates.length}] ✅ ${imported}  ↷ ${skipped}  ? ${notFound}  ❌ ${errors}`)
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n\n' + '─'.repeat(50))
  console.log('🎉 Import complete!')
  console.log(`   ✅ Imported   : ${imported}`)
  console.log(`   ↷  Skipped    : ${skipped} (already in DB)`)
  console.log(`   ?  Not found  : ${notFound} (patient name not matched)`)
  console.log(`   ❌ Errors     : ${errors}`)

  if (notFoundNames.length > 0) {
    console.log(`\n⚠️  Unmatched patient names (${notFoundNames.length}):`)
    for (const name of notFoundNames.slice(0, 30)) {
      console.log(`     - ${name}`)
    }
    if (notFoundNames.length > 30) {
      console.log(`     ... and ${notFoundNames.length - 30} more`)
    }
    console.log('\n   Tip: Import patient data first via /director/import, then re-run this script.')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
