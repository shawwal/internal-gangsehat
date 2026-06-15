/**
 * Import individual therapy sessions from CATATAN KEUANGAN FGS PTK 2026.xlsx
 * → patient_visits table, with package_id linked to active patient_packages.
 *
 * Run: npx tsx scripts/import-sessions.mts
 *
 * Source: public/CATATAN KEUANGAN FGS PTK 2026.xlsx → sheet "⬇️ PEMASUKAN"
 * Filters: PEMBELIAN rows for sessions (K.ST, K.TA, K.L SESI, V.ST, V.TA, STUDIO sessions)
 *
 * Strategy:
 *  1. Parse PEMASUKAN sheet, filter session rows via SESSION_MAP
 *  2. Decrypt all patient names → name→id lookup
 *  3. Match FISIO shortnames → internal_profiles.id
 *  4. Load active packages with remaining_sessions from the view
 *  5. Deduplicate against existing patient_visits
 *  6. Insert visits, assigning package_id (oldest active package first)
 */

import * as XLSX from 'xlsx'
import { createDecipheriv } from 'crypto'
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

// ── Decrypt helper ───────────────────────────────────────────────────────────
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
    try {
      const decoded = Buffer.from(text, 'base64').toString('utf8')
      const printable = decoded.replace(/[^\x20-\x7E -￿]/g, '')
      if (printable.length >= decoded.length * 0.8) return decoded
    } catch { /* ignore */ }
    return text
  }
}

// ── Session type mapping ─────────────────────────────────────────────────────
// links_to_package: true = consume a session from patient's active package
const SESSION_MAP: Record<string, { service_type: string; links_to_package: boolean }> = {
  'K.ST - SESI TERAPI':               { service_type: 'SESI TERAPI', links_to_package: true  },
  'K.ST - SESI TERAPI NEW':           { service_type: 'SESI TERAPI', links_to_package: true  },
  'K.TA - TERAPI AWAL':               { service_type: 'TERAPI AWAL', links_to_package: false },
  'K.L - SESI TERAPI':                { service_type: 'SESI TERAPI', links_to_package: true  },
  'STUDIO.SKOLIOSIS - SESI TERAPI':   { service_type: 'SESI TERAPI', links_to_package: true  },
  'STUDIO.SKOLIOSIS- SESI TERAPI':    { service_type: 'SESI TERAPI', links_to_package: true  }, // typo variant
  'V.ST - SESI VISIT':                { service_type: 'SESI VISIT',  links_to_package: true  },
  'V.ST - SESI VISIT + JARAK':        { service_type: 'SESI VISIT',  links_to_package: true  },
  'V.TA - TERAPI AWAL VISIT':         { service_type: 'TA VISIT',    links_to_package: false },
  'V.TA - TERAPI AWAL VISIT + JARAK': { service_type: 'TA VISIT',    links_to_package: false },
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

  if (!branch) { console.error('❌ No active branches found.'); process.exit(1) }
  console.log(`🏥 Branch: ${branch.name} (${branch.id})`)

  // ── 1. Parse Excel ─────────────────────────────────────────────────────────
  console.log('\n📖 Reading Excel...')
  const buffer = readFileSync(EXCEL_PATH)
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })

  const sheetName = wb.SheetNames.find((n: string) => n.toLowerCase().includes('pemasukan')) ?? wb.SheetNames[0]
  console.log(`📋 Sheet: "${sheetName}"`)

  const sheet = wb.Sheets[sheetName]
  const rows: (string | number | boolean | null)[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })

  let headerRowIdx = -1
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    if (rows[i]?.some((c) => String(c ?? '').toUpperCase().includes('NAMA PASIEN'))) {
      headerRowIdx = i
      break
    }
  }
  if (headerRowIdx === -1) { console.error('❌ Header row with "NAMA PASIEN" not found.'); process.exit(1) }

  const headers = rows[headerRowIdx].map((h) => String(h ?? '').toUpperCase().trim())
  const namaIdx      = headers.indexOf('NAMA PASIEN')
  const pembelianIdx = headers.findIndex((h) => h === 'PEMBELIAN')
  const tanggalIdx   = headers.indexOf('TANGGAL')
  const fisioIdx     = headers.indexOf('FISIO')

  console.log(`   NAMA PASIEN: col ${namaIdx} | PEMBELIAN: col ${pembelianIdx} | TANGGAL: col ${tanggalIdx} | FISIO: col ${fisioIdx}`)

  const dataRows = rows.slice(headerRowIdx + 1)

  // ── 2. Filter session rows ─────────────────────────────────────────────────
  console.log('\n🔍 Filtering session rows...')

  type Candidate = {
    rawName:          string
    service_type:     string
    links_to_package: boolean
    visit_date:       string | null
    fisio:            string
  }

  const candidates: Candidate[] = []

  for (const row of dataRows) {
    if (!row) continue
    const rawNama      = String(row[namaIdx]      ?? '').trim()
    const rawPembelian = String(row[pembelianIdx] ?? '').trim()
    if (!rawNama || !rawPembelian) continue

    const mapped = SESSION_MAP[rawPembelian]
    if (!mapped) continue

    const visit_date = tanggalIdx !== -1 ? excelSerialToIso(Number(row[tanggalIdx] ?? 0)) : null
    const fisio      = String(row[fisioIdx] ?? '').trim().toUpperCase()

    candidates.push({ rawName: rawNama, ...mapped, visit_date, fisio })
  }

  console.log(`   ${candidates.length} session rows found`)

  // Breakdown by service type
  const breakdown: Record<string, number> = {}
  for (const c of candidates) {
    breakdown[c.service_type] = (breakdown[c.service_type] ?? 0) + 1
  }
  for (const [type, count] of Object.entries(breakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${count.toString().padStart(4)}  ${type}`)
  }

  if (candidates.length === 0) { console.log('\nℹ️  No session rows found.'); return }

  // ── 3. Decrypt patient names ───────────────────────────────────────────────
  console.log('\n🔓 Loading + decrypting patient names...')
  const nameToId = new Map<string, string>()
  let patFrom = 0; let totalPat = 0

  while (true) {
    const { data, error } = await supabase
      .from('patients')
      .select('id, encrypted_name')
      .eq('is_active', true)
      .range(patFrom, patFrom + 499)
    if (error) { console.error('   Error:', error.message); break }
    if (!data?.length) break
    for (const p of data) {
      if (!p.encrypted_name) continue
      try {
        const name = decrypt(p.encrypted_name)
        if (name) nameToId.set(normalizeName(name), p.id)
      } catch { /* skip */ }
    }
    totalPat += data.length
    process.stdout.write(`\r   Loaded ${totalPat} patients...`)
    if (data.length < 500) break
    patFrom += 500
  }
  console.log(`\r   ${nameToId.size} unique names from ${totalPat} records`)

  // ── 4. Load & match therapists ─────────────────────────────────────────────
  console.log('\n👤 Matching FISIO shortnames to internal_profiles...')

  const { data: profiles } = await supabase
    .from('internal_profiles')
    .select('id, full_name')
    .eq('is_active', true)

  // Build shortname → profile_id map
  // Strategy: first word of full_name uppercase (e.g. "WAHYU PRATAMA" → "WAHYU")
  //           fallback: first 3 chars uppercase (e.g. "AULIA" → "AUL")
  const firstWordMap  = new Map<string, string>() // firstWord → id
  const first3Map     = new Map<string, string>() // first3    → id

  for (const p of profiles ?? []) {
    if (!p.full_name) continue
    const firstWord = p.full_name.trim().toUpperCase().split(/\s+/)[0]
    if (firstWord) firstWordMap.set(firstWord, p.id)
    if (firstWord.length >= 3) first3Map.set(firstWord.slice(0, 3), p.id)
  }

  // Collect unique FISIO values from candidates
  const uniqueFisio = [...new Set(candidates.map((c) => c.fisio).filter(Boolean))]

  const fisioToId = new Map<string, string | null>()
  const unmatchedFisio: string[] = []

  console.log('\n   FISIO mapping:')
  for (const fisio of uniqueFisio.sort()) {
    if (fisio === 'LAINNYA' || fisio === '') {
      fisioToId.set(fisio, null)
      console.log(`     ${fisio.padEnd(12)} → (no therapist)`)
      continue
    }
    const byFirst = firstWordMap.get(fisio)
    if (byFirst) {
      const fullName = profiles?.find((p) => p.id === byFirst)?.full_name ?? '?'
      fisioToId.set(fisio, byFirst)
      console.log(`     ${fisio.padEnd(12)} → ${fullName}`)
      continue
    }
    const by3 = first3Map.get(fisio.slice(0, 3))
    if (by3) {
      const fullName = profiles?.find((p) => p.id === by3)?.full_name ?? '?'
      fisioToId.set(fisio, by3)
      console.log(`     ${fisio.padEnd(12)} → ${fullName} (3-char match)`)
      continue
    }
    fisioToId.set(fisio, null)
    unmatchedFisio.push(fisio)
    console.log(`     ${fisio.padEnd(12)} → ⚠️  NOT MATCHED`)
  }

  if (unmatchedFisio.length > 0) {
    console.log(`\n   ⚠️  ${unmatchedFisio.length} unresolved FISIO shortname(s): ${unmatchedFisio.join(', ')}`)
    console.log('   Sessions for these therapists will be imported without attending_staff_id.')
  }

  // ── 5. Load active packages with remaining sessions ────────────────────────
  console.log('\n📦 Loading active packages...')

  type PkgInfo = { id: string; package_name: string; remaining: number; created_at: string }
  const patientPackages = new Map<string, PkgInfo[]>() // patient_id → sorted packages

  let pkgFrom = 0
  while (true) {
    const { data, error } = await supabase
      .from('patient_packages_with_stats')
      .select('id, patient_id, package_name, total_sessions, remaining_sessions, created_at')
      .eq('status', 'active')
      .range(pkgFrom, pkgFrom + 499)
    if (error) { console.error('   Error:', error.message); break }
    if (!data?.length) break
    for (const p of data as { id: string; patient_id: string; package_name: string; total_sessions: number; remaining_sessions: number; created_at: string }[]) {
      const rem = Number(p.remaining_sessions ?? p.total_sessions)
      if (!patientPackages.has(p.patient_id)) patientPackages.set(p.patient_id, [])
      patientPackages.get(p.patient_id)!.push({
        id: p.id,
        package_name: p.package_name,
        remaining: rem,
        created_at: p.created_at,
      })
    }
    if (data.length < 500) break
    pkgFrom += 500
  }

  // Sort each patient's packages oldest first (consume oldest package first)
  for (const [, pkgs] of patientPackages) {
    pkgs.sort((a, b) => a.created_at.localeCompare(b.created_at))
  }

  const totalPackages = [...patientPackages.values()].reduce((s, p) => s + p.length, 0)
  console.log(`   ${totalPackages} active packages loaded for ${patientPackages.size} patients`)

  // ── 6. Load existing visits for deduplication ──────────────────────────────
  console.log('\n🔍 Loading existing visits for dedup check...')

  const existingVisits = new Set<string>() // "patient_id|visit_date|service_type"
  let visFrom = 0

  while (true) {
    const { data, error } = await supabase
      .from('patient_visits')
      .select('patient_id, visit_date, service_type')
      .range(visFrom, visFrom + 999)
    if (error) { console.error('   Error:', error.message); break }
    if (!data?.length) break
    for (const v of data as { patient_id: string; visit_date: string; service_type: string }[]) {
      existingVisits.add(`${v.patient_id}|${v.visit_date}|${v.service_type}`)
    }
    if (data.length < 1000) break
    visFrom += 1000
  }
  console.log(`   ${existingVisits.size} existing visits loaded`)

  // ── 7. Insert sessions ─────────────────────────────────────────────────────
  console.log('\n⬆️  Importing sessions...\n')

  let imported   = 0
  let skipped    = 0
  let notFound   = 0
  let noPackage  = 0
  let errors     = 0
  const notFoundNames: string[] = []

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    const norm      = normalizeName(c.rawName)
    const patientId = nameToId.get(norm)

    if (!patientId) {
      notFound++
      if (!notFoundNames.includes(c.rawName)) notFoundNames.push(c.rawName)
      process.stdout.write(`\r   [${i+1}/${candidates.length}] ✅ ${imported}  ↷ ${skipped}  ? ${notFound}  📦 ${noPackage}  ❌ ${errors}`)
      continue
    }

    const visit_date = c.visit_date ?? new Date().toISOString().split('T')[0]
    const dupKey = `${patientId}|${visit_date}|${c.service_type}`
    if (existingVisits.has(dupKey)) {
      skipped++
      process.stdout.write(`\r   [${i+1}/${candidates.length}] ✅ ${imported}  ↷ ${skipped}  ? ${notFound}  📦 ${noPackage}  ❌ ${errors}`)
      continue
    }

    // Find therapist
    const therapistId = fisioToId.get(c.fisio) ?? null

    // Find package to link
    let packageId: string | null = null
    if (c.links_to_package) {
      const pkgs = patientPackages.get(patientId) ?? []
      const pkg  = pkgs.find((p) => p.remaining > 0)
      if (pkg) {
        packageId = pkg.id
        pkg.remaining--
      } else {
        noPackage++
      }
    }

    const { error: insertErr } = await supabase.from('patient_visits').insert({
      patient_id:        patientId,
      branch_id:         branch.id,
      visit_date,
      service_type:      c.service_type,
      attending_staff_id: therapistId,
      package_id:        packageId,
      status:            'completed',
      kehadiran:         'HADIR',
    })

    if (insertErr) {
      errors++
      console.error(`\n   ❌ ${c.rawName} / ${c.service_type} / ${visit_date}: ${insertErr.message}`)
    } else {
      imported++
      existingVisits.add(dupKey)
    }

    process.stdout.write(`\r   [${i+1}/${candidates.length}] ✅ ${imported}  ↷ ${skipped}  ? ${notFound}  📦 ${noPackage}  ❌ ${errors}`)
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n\n' + '─'.repeat(50))
  console.log('🎉 Import complete!')
  console.log(`   ✅ Imported         : ${imported}`)
  console.log(`   ↷  Skipped (dup)    : ${skipped}`)
  console.log(`   ?  Patient not found: ${notFound}`)
  console.log(`   📦 No package linked: ${noPackage} (session without matching package)`)
  console.log(`   ❌ Errors           : ${errors}`)

  if (notFoundNames.length > 0) {
    console.log(`\n⚠️  Unmatched patient names (${notFoundNames.length}):`)
    for (const name of notFoundNames.slice(0, 30)) console.log(`     - ${name}`)
    if (notFoundNames.length > 30) console.log(`     ... and ${notFoundNames.length - 30} more`)
    console.log('\n   Tip: Import patients first via /director/import, then re-run this script.')
  }

  if (unmatchedFisio.length > 0) {
    console.log(`\n⚠️  Unresolved FISIO shortnames (${unmatchedFisio.length}): ${unmatchedFisio.join(', ')}`)
    console.log('   Add these to the fisioToId map manually if needed.')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
