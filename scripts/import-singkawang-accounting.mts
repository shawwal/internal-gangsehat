/**
 * Import Singkawang bookkeeping from "AKUNTANSI FGS SINGKAWANG .xlsx" → transactions (Singkawang branch).
 * Run after import-singkawang-history.mts:
 *   npx tsx scripts/import-singkawang-accounting.mts [--dry-run]
 *   (AKUNTANSI_XLSX=… / FISIO_XLSX=… override the workbook locations)
 *
 * - "Pemasukan" → income, confirmed, LUNAS. Total = Harga Paket − Biaya Lainnya, so Biaya Lainnya
 *   is stored as `discount`. Patient = unique name match in the Singkawang roster (Ny./Tn./Nn./An.
 *   stripped); unmatched rows still import, with the name kept in the description.
 *   Linked to that day's visit (same patient, matching service) when exactly one unpaid one exists,
 *   with fisio_id = the visit's therapist.
 * - "Pengeluaran" → expense, confirmed, mapped onto the app's expense categories; the sheet's
 *   own category stays in the description.
 * - TRF → TRANSFER BCA. recorded_by NULL marks imported rows (same as import-transactions-finance).
 * - Re-runnable: every row carries "[AKT-SKW <sheet> #No]" in its description and is skipped if present.
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  DRY_RUN, SINGKAWANG_BRANCH_ID as BRANCH, XLSX, anyDate, createAdmin, fetchAll,
  loadPatientResolver, str,
} from './lib/singkawang.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BOOK_PATH = process.env.AKUNTANSI_XLSX ?? join(__dirname, '../AKUNTANSI FGS SINGKAWANG .xlsx')

const INCOME_CATEGORY: Record<string, string> = {
  'TERAPI AWAL':             'TERAPI AWAL KLINIK',
  'SESI TERAPI':             'SESI KLINIK',
  'PAKET TERAPI 1':          'PAKET KLINIK',
  'PAKET TERAPI 2':          'PAKET KLINIK',
  'PAKET TERAPI 3':          'PAKET KLINIK',
  'TERAPI AWAL HOMEVISIT':   'TERAPI AWAL VISIT',
  'SESI TERAPI HOMEVISIT':   'SESI VISIT',
  'PAKET TERAPI HOMEVISIT':  'PAKET VISIT',
}

// Income category → the visit service it pays for
const VISIT_SERVICE: Record<string, string> = {
  'TERAPI AWAL KLINIK': 'TERAPI AWAL KLINIK',
  'SESI KLINIK':        'SESI KLINIK',
  'PAKET KLINIK':       'PAKET KLINIK',
  'TERAPI AWAL VISIT':  'TERAPI AWAL VISIT',
  'SESI VISIT':         'SESI VISIT',
  'PAKET VISIT':        'PAKET VISIT',
}

const EXPENSE_CATEGORY: Record<string, string> = {
  'BEBAN PELAYANAN':        'BEBAN PELAYANAN',
  'BEBAN PELAYANAN DEWASA': 'BEBAN PELAYANAN',
  'BEBAN PELAYANAN ANAK':   'BEBAN PELAYANAN',
  'BEBAN LISTRIK':          'LISTRIK',
  'BEBAN GAJI PEGAWAI':     'GAJI',
  'BEBAN PROMOSI':          'MARKETING',
}

const PAYMENT_METHOD: Record<string, string> = { TUNAI: 'TUNAI', TRF: 'TRANSFER BCA' }

function money(v: unknown): number {
  if (typeof v === 'number') return v
  const digits = str(v).replace(/,\d{1,2}$/, '').replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

// "New Sesi terapi Homevisit + Jarak " → "SESI TERAPI HOMEVISIT" (New = 2024 price list, Jarak = distance fee)
function serviceKey(v: unknown): string {
  return str(v).toUpperCase().replace(/^NEW\s+/, '').replace(/\+\s*JARAK/, '').replace(/\s+/g, ' ').trim()
}

function stripHonorific(name: string): string {
  return name.replace(/^\s*(NY|TN|NN|AN|SDR|SDRI|BY)\.?\s+/i, '').trim()
}

type TxRow = { label: string; marker: string; visitId: string | null; insert: Record<string, unknown> }

async function main() {
  if (DRY_RUN) console.log('🧪 DRY RUN — no writes will be made\n')
  const supabase = createAdmin()

  console.log('🔍 Loading patients, visits and transactions...')
  const { resolvePatient } = await loadPatientResolver(supabase)

  const existing = await fetchAll<{ description: string | null; visit_id: string | null }>((f, t) => supabase
    .from('transactions').select('description, visit_id').eq('branch_id', BRANCH).order('id').range(f, t))
  const markers = new Set(existing.map(t => t.description?.match(/\[AKT-SKW [^\]]+\]/)?.[0]).filter(Boolean))
  const paidVisits = new Set(existing.map(t => t.visit_id).filter(Boolean))

  const visits = await fetchAll<{
    id: string; patient_id: string; visit_date: string; service_type: string | null
    status: string; attending_staff_id: string | null
  }>((f, t) => supabase.from('patient_visits')
    .select('id, patient_id, visit_date, service_type, status, attending_staff_id').eq('branch_id', BRANCH).order('id').range(f, t))
  const visitsByDay = new Map<string, typeof visits>()
  for (const v of visits) {
    if (v.status === 'cancelled') continue
    const k = `${v.patient_id}|${v.visit_date}`
    visitsByDay.set(k, [...(visitsByDay.get(k) ?? []), v])
  }

  const book = XLSX.read(readFileSync(BOOK_PATH))
  const sheet = (n: string) => XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[n], { header: 1, raw: true, defval: null })

  const rows: TxRow[] = []
  const skippedExisting: string[] = []
  const bad: string[] = []
  const noPatient: string[] = []

  // ── Pemasukan: 0 ✓, 1 No, 2 Tanggal, 3 Nama Pasien, 4 Jenis, 5 Harga, 6 Pembayaran, 7 Biaya Lainnya, 8 Total
  const income = sheet('Pemasukan')
  for (let i = 3; i < income.length; i++) {
    const c = income[i] ?? []
    if (!str(c[3])) continue
    const label = `Pemasukan #${str(c[1])} ${str(c[3])}`
    const date = anyDate(c[2])
    const category = INCOME_CATEGORY[serviceKey(c[4])]
    const amount = money(c[8])
    if (!date || !category || amount <= 0) { bad.push(`${label}: tanggal "${str(c[2])}" jenis "${str(c[4])}" total "${str(c[8])}"`); continue }

    const marker = `[AKT-SKW pemasukan #${str(c[1])}]`
    if (markers.has(marker)) { skippedExisting.push(label); continue }

    const patientId = resolvePatient(null, stripHonorific(str(c[3])))
    if (!patientId) noPatient.push(`${str(c[3])} (${date})`)

    // Pay the matching visit that day — only when exactly one unpaid candidate exists
    let visit: (typeof visits)[number] | undefined
    if (patientId) {
      const candidates = (visitsByDay.get(`${patientId}|${date}`) ?? [])
        .filter(v => v.service_type === VISIT_SERVICE[category] && !paidVisits.has(v.id))
      if (candidates.length === 1) {
        visit = candidates[0]
        paidVisits.add(visit.id)
      }
    }

    rows.push({
      label, marker, visitId: visit?.id ?? null,
      insert: {
        branch_id:        BRANCH,
        patient_id:       patientId,
        visit_id:         visit?.id ?? null,
        fisio_id:         visit?.attending_staff_id ?? null,
        type:             'income',
        category,
        harga:            money(c[5]) || amount,
        discount:         money(c[7]),
        amount,
        payment_method:   PAYMENT_METHOD[str(c[6]).toUpperCase()] ?? null,
        payment_status:   'LUNAS',
        status:           'confirmed',
        transaction_date: date,
        description:      `${str(c[4])} · ${str(c[3])} ${marker}`,
        recorded_by:      null,
      },
    })
  }

  // ── Pengeluaran: 1 ✓, 2 No, 3 Tanggal, 4 Kategori, 5 Nominal, 6 Detail, 7 Instansi
  const expense = sheet('Pengeluaran')
  for (let i = 2; i < expense.length; i++) {
    const c = expense[i] ?? []
    if (!str(c[4]) && !str(c[6])) continue
    const label = `Pengeluaran #${str(c[2])} ${str(c[4])} ${str(c[6])}`
    const date = anyDate(c[3])
    const amount = money(c[5])
    if (!date || amount <= 0) { bad.push(`${label}: tanggal "${str(c[3])}" nominal "${str(c[5])}"`); continue }

    const marker = `[AKT-SKW pengeluaran #${str(c[2])}]`
    if (markers.has(marker)) { skippedExisting.push(label); continue }

    const sheetCategory = str(c[4]).toUpperCase().replace(/\s+/g, ' ')
    rows.push({
      label, marker, visitId: null,
      insert: {
        branch_id:        BRANCH,
        type:             'expense',
        category:         EXPENSE_CATEGORY[sheetCategory] ?? 'LAINNYA',
        amount,
        payment_method:   PAYMENT_METHOD[str(c[7]).toUpperCase()] ?? null,
        status:           'confirmed',
        transaction_date: date,
        description:      [str(c[4]), str(c[6])].filter(Boolean).join(' · ') + ` ${marker}`,
        recorded_by:      null,
      },
    })
  }

  // ── Summary ──
  const summary: Record<string, { count: number; total: number }> = {}
  const byMonth: Record<string, { income: number; expense: number }> = {}
  for (const r of rows) {
    const k = `${r.insert.type} | ${r.insert.category}`
    summary[k] ??= { count: 0, total: 0 }
    summary[k].count++
    summary[k].total += r.insert.amount as number
    const m = String(r.insert.transaction_date).slice(0, 7)
    byMonth[m] ??= { income: 0, expense: 0 }
    byMonth[m][r.insert.type as 'income' | 'expense'] += r.insert.amount as number
  }
  const incomeRows = rows.filter(r => r.insert.type === 'income')
  console.log(`\n💰 ${incomeRows.length} income + ${rows.length - incomeRows.length} expense rows new, ${skippedExisting.length} already imported`)
  console.log(`   Income linked to a patient: ${incomeRows.filter(r => r.insert.patient_id).length} · to a visit: ${incomeRows.filter(r => r.visitId).length}`)
  console.table(summary)
  console.table(byMonth)

  // ── Write ──
  const errors: string[] = []
  if (!DRY_RUN) {
    let done = 0
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200)
      const { error } = await supabase.from('transactions').insert(chunk.map(r => r.insert))
      if (!error) done += chunk.length
      else {
        for (const r of chunk) { // isolate the bad row(s)
          const { error: e } = await supabase.from('transactions').insert(r.insert)
          if (e) errors.push(`${r.label}: ${e.message}`)
          else done++
        }
      }
      process.stdout.write(`\r   transactions: ${done}/${rows.length}`)
    }
    console.log()
  }

  console.log('\n' + '─'.repeat(55))
  console.log(DRY_RUN ? '🧪 Dry run complete!' : '🎉 Import complete!')
  console.log(`   ❌ Errors: ${errors.length}`)
  const dump = (title: string, list: string[]) => {
    if (!list.length) return
    console.log(`\n${title} (${list.length}):`)
    for (const s of list) console.log(`   - ${s}`)
  }
  dump('👤 Income without a unique patient match (imported, name kept in description)', noPatient)
  dump('⚠️  Unparseable rows (skipped)', bad)
  dump('⚠️  Errors', errors)
}

main().catch((e) => { console.error(e); process.exit(1) })
