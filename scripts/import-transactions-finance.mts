/**
 * Import transactions from "CATATAN KEUANGAN FGS PTK 2026.xlsx"
 * Source: data_migrations/CATATAN KEUANGAN FGS PTK 2026.xlsx
 *   Sheet "⬇️ PEMASUKAN"  → type=income  (patient matched via patients.name_normalized)
 *   Sheet "⬆️ PENGELUARAN" → type=expense
 *
 * Run: npx tsx scripts/import-transactions-finance.mts
 *
 * Safe to re-run — deletes previously imported rows (recorded_by IS NULL) first.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Load .env ─────────────────────────────────────────────────────────────────
const envRaw = readFileSync(join(__dirname, '../.env'), 'utf8')
const env: Record<string, string> = {}
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim()
}

const SUPABASE_URL     = env['NEXT_PUBLIC_SUPABASE_URL']  ?? ''
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EXCEL_FILE = join(__dirname, '../data_migrations/CATATAN KEUANGAN FGS PTK 2026.xlsx')
const BATCH_SIZE = 100

// ── Category / status mappings ────────────────────────────────────────────────
const INCOME_CATEGORIES = new Set([
  'TA KLINIK', 'PAKET KLINIK', 'SESI KLINIK',
  'TA VISIT', 'SESI VISIT', 'PAKET VISIT', 'LAINNYA',
])
function mapIncomeCategory(raw: string): string {
  const v = String(raw ?? '').trim().toUpperCase()
  return INCOME_CATEGORIES.has(v) ? v : 'LAINNYA'
}
function mapPaymentStatus(raw: string): string {
  const v = String(raw ?? '').trim().toUpperCase()
  if (v === 'LUNAS')     return 'LUNAS'
  if (v === 'PELUNASAN') return 'PELUNASAN'
  return 'DP'
}
function mapPaymentMethod(raw: string): string {
  const v = String(raw ?? '').trim().toUpperCase()
  if (v === 'EDC BCA')                              return 'EDC BCA'
  if (v.includes('TRANSFER') || v.includes('BANK')) return 'TRANSFER BCA'
  return 'TUNAI'
}
const EXPENSE_CAT_MAP: Record<string, string> = {
  'BEBAN GAJI':          'GAJI',
  'GAJI':                'GAJI',
  'BEBAN PELAYANAN FGS': 'BEBAN PELAYANAN',
  'BEBAN PELAYANAN':     'BEBAN PELAYANAN',
  'JARAK VISIT':         'BEBAN PELAYANAN',
  'TUKAR TUNAI':         'TUKAR TUNAI',
  'HESTI TT':            'TUKAR TUNAI',
  'TARIK TUNAI':         'TUKAR TUNAI',
  'SEWA':                'SEWA',
  'LISTRIK':             'LISTRIK',
  'MARKETING':           'MARKETING',
}
function mapExpenseCategory(raw: string): string {
  const v = String(raw ?? '').trim().toUpperCase()
  return EXPENSE_CAT_MAP[v] ?? 'LAINNYA'
}

function excelDateToISO(serial: number): string | null {
  if (!serial || typeof serial !== 'number') return null
  const parsed = XLSX.SSF.parse_date_code(serial)
  if (!parsed) return null
  return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
}

// Normalize Excel patient name to match patients.name_normalized format (lowercase)
function normExcelName(raw: string): string {
  return raw.toLowerCase().replace(/[.\-,]/g, ' ').replace(/\s+/g, ' ').trim()
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📂 Reading Excel file…')
  const wb = XLSX.readFile(EXCEL_FILE)

  // ── Find Pontianak branch ──────────────────────────────────────────────────
  const { data: branches } = await supabase.from('branches').select('id, name')
  const ptkBranch = (branches ?? []).find(b => /pontianak|ptk|fgs/i.test(b.name))
  if (!ptkBranch) {
    console.error('❌ Pontianak branch not found. Available:', (branches ?? []).map(b => b.name))
    process.exit(1)
  }
  const branchId = ptkBranch.id
  console.log(`✅ Branch: ${ptkBranch.name} (${branchId})`)

  // ── Delete previously imported transactions ────────────────────────────────
  const { count: delCount } = await supabase
    .from('transactions')
    .delete({ count: 'exact' })
    .eq('branch_id', branchId)
    .is('recorded_by', null)
  console.log(`🗑  Deleted ${delCount ?? 0} previous import rows\n`)

  // ── Load patients.name_normalized → id map ─────────────────────────────────
  console.log('👥 Loading patients name index…')
  const nameMap  = new Map<string, string>()  // exact normalized → id
  let page = 0
  const PAGE = 1000
  while (true) {
    const { data } = await supabase
      .from('patients')
      .select('id, name_normalized')
      .range(page * PAGE, (page + 1) * PAGE - 1)
    if (!data || data.length === 0) break
    for (const p of data) {
      if (p.name_normalized) nameMap.set(p.name_normalized.toLowerCase().trim(), p.id)
    }
    if (data.length < PAGE) break
    page++
  }
  console.log(`  ${nameMap.size} patients indexed\n`)

  function resolvePatient(rawName: string): string | null {
    if (!rawName || rawName === '-') return null
    const norm = normExcelName(rawName)

    // 1. Exact match
    if (nameMap.has(norm)) return nameMap.get(norm)!

    // 2. Try progressively shorter prefixes (handles extra middle/last names in Excel)
    const words = norm.split(' ')
    for (let len = words.length - 1; len >= 2; len--) {
      const prefix = words.slice(0, len).join(' ')
      if (nameMap.has(prefix)) return nameMap.get(prefix)!
    }

    // 3. Check if any DB name starts with or contains the Excel name
    for (const [dbName, id] of nameMap) {
      if (dbName.startsWith(norm) || norm.startsWith(dbName)) return id
    }

    return null
  }

  // ── Parse PEMASUKAN (income) ───────────────────────────────────────────────
  const incSheet = wb.Sheets['⬇️ PEMASUKAN']
  const incRows  = XLSX.utils.sheet_to_json<unknown[]>(incSheet, { header: 1, defval: '' })

  const incomeRows: Record<string, unknown>[] = []
  let incSkipped = 0, incNoPatient = 0

  for (const row of incRows.slice(4)) {
    const r = row as unknown[]
    const serial   = r[3] as number
    const tahun    = r[4] as string
    const verified = r[19]
    const amount   = Number(r[13]) || 0
    const harga    = Number(r[15]) || 0
    const discount = Number(r[14]) || 0

    if (!serial || !tahun || !verified || (amount === 0 && harga === 0)) { incSkipped++; continue }

    const transaction_date = excelDateToISO(serial)
    if (!transaction_date) { incSkipped++; continue }

    const patientName = String(r[8] ?? '').trim()
    const patient_id  = resolvePatient(patientName)
    if (!patient_id) incNoPatient++

    const penjamin = String(r[18] ?? '').trim()

    incomeRows.push({
      branch_id:        branchId,
      patient_id:       patient_id ?? null,
      type:             'income',
      category:         mapIncomeCategory(String(r[11] ?? '')),
      harga,
      discount,
      amount,
      payment_method:   mapPaymentMethod(String(r[17] ?? '')),
      payment_status:   mapPaymentStatus(String(r[12] ?? '')),
      penjamin:         penjamin && penjamin !== '-' ? penjamin : null,
      description:      String(r[10] ?? '').trim() || null,
      transaction_date,
      status:           'confirmed',
    })
  }

  const matched = incomeRows.filter(r => r.patient_id).length
  console.log(`💰 Income: ${incomeRows.length} rows, ${incSkipped} skipped`)
  console.log(`   Patient match: ${matched}/${incomeRows.length} (${Math.round(matched / incomeRows.length * 100)}%)`)

  // ── Parse PENGELUARAN (expense) ────────────────────────────────────────────
  const expSheet = wb.Sheets['⬆️ PENGELUARAN']
  const expRows  = XLSX.utils.sheet_to_json<unknown[]>(expSheet, { header: 1, defval: '' })

  const expenseRows: Record<string, unknown>[] = []
  let expSkipped = 0

  for (const row of expRows.slice(4)) {
    const r = row as unknown[]
    const serial   = r[3] as number
    const tahun    = r[4] as string
    const verified = r[10]
    const amount   = Number(r[6]) || 0

    if (!serial || !tahun || !verified || amount === 0) { expSkipped++; continue }

    const transaction_date = excelDateToISO(serial)
    if (!transaction_date) { expSkipped++; continue }

    expenseRows.push({
      branch_id:        branchId,
      type:             'expense',
      category:         mapExpenseCategory(String(r[9] ?? '')),
      harga:            amount,
      discount:         0,
      amount,
      payment_method:   mapPaymentMethod(String(r[7] ?? '')),
      payment_status:   null,
      penjamin:         null,
      description:      String(r[8] ?? '').trim() || null,
      transaction_date,
      status:           'confirmed',
    })
  }

  console.log(`💸 Expense: ${expenseRows.length} rows, ${expSkipped} skipped`)

  // ── Insert in batches ──────────────────────────────────────────────────────
  const allRows = [...incomeRows, ...expenseRows]
  console.log(`\n🚀 Inserting ${allRows.length} rows…`)

  let inserted = 0, errors = 0
  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const batch = allRows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('transactions').insert(batch)
    if (error) {
      console.error(`  ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message)
      errors += batch.length
    } else {
      inserted += batch.length
      process.stdout.write(`  ✅ ${inserted}/${allRows.length}\r`)
    }
  }

  console.log(`\n\n✅ Done! Inserted: ${inserted}, Errors: ${errors}`)
  console.log(`👤 ${matched} of ${incomeRows.length} income rows have a patient linked`)
}

main().catch((e) => { console.error(e); process.exit(1) })
