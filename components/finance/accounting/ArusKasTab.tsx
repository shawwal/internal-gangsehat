'use client'

import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { fetchTransactionsForRange, fetchOpeningBalance, setOpeningBalance, type AccountingTxnRow } from '@/app/actions/accounting'
import { fetchExpenseCategories, type ExpenseCategoryRow } from '@/app/actions/accounting'
import { exportToExcel, type ExportColumn } from '@/lib/excel-export'
import { openPrintableReport } from '@/lib/pdf-export'
import { ExportMenu } from './ExportMenu'
import { formatRp, MONTH_NAMES, INCOME_CATEGORIES, yearRange, inputCls } from './shared'

interface Props {
  branchId: string
  branchName: string
}

interface MatrixRow { key: string; label: string; monthly: number[] }

/** transaction_date is a plain "YYYY-MM-DD" string — parse the month directly
 * rather than via `new Date(...)`, which reinterprets it in the browser's local
 * timezone and can shift dates near midnight into the wrong month. */
function monthIndexOf(dateStr: string): number {
  return Number(dateStr.slice(5, 7)) - 1
}

export function ArusKasTab({ branchId, branchName }: Props) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [txns, setTxns] = useState<AccountingTxnRow[]>([])
  const [expenseCats, setExpenseCats] = useState<ExpenseCategoryRow[]>([])
  const [opening, setOpening] = useState(0)
  const [openingInput, setOpeningInput] = useState('0')
  const [loading, setLoading] = useState(true)
  const [savingBalance, setSavingBalance] = useState(false)

  useEffect(() => {
    setLoading(true)
    const { from, toExclusive } = yearRange(year)
    Promise.all([
      fetchTransactionsForRange(branchId, from, toExclusive),
      fetchExpenseCategories(branchId),
      fetchOpeningBalance(branchId, year),
    ]).then(([t, e, ob]) => {
      setTxns(t)
      setExpenseCats(e.filter((r) => r.is_active))
      setOpening(ob)
      setOpeningInput(String(ob))
      setLoading(false)
    })
  }, [branchId, year])

  // Income rows key off the same coarse category bucket `transactions.category`
  // stores app-wide (TA KLINIK, PAKET KLINIK, ...) — not the specific item name,
  // since that's the only thing consistently recorded across every entry point
  // (finance/transactions, director/finance, PaymentDialog, and this page).
  const incomeRows = useMemo<MatrixRow[]>(() => {
    return INCOME_CATEGORIES.map((cat) => {
      const monthly = Array.from({ length: 12 }, (_, mi) =>
        txns.filter((t) => t.type === 'income' && t.category === cat && monthIndexOf(t.transaction_date) === mi)
          .reduce((s, t) => s + Number(t.amount), 0),
      )
      return { key: cat, label: cat, monthly }
    })
  }, [txns])

  const expenseRows = useMemo<MatrixRow[]>(() => {
    return expenseCats.map((c) => {
      const monthly = Array.from({ length: 12 }, (_, mi) =>
        txns.filter((t) => t.type === 'expense' && t.category === c.name && monthIndexOf(t.transaction_date) === mi)
          .reduce((s, t) => s + Number(t.amount), 0),
      )
      return { key: c.id, label: c.name, monthly }
    })
  }, [expenseCats, txns])

  const incomeTotals = Array.from({ length: 12 }, (_, mi) => incomeRows.reduce((s, r) => s + r.monthly[mi], 0))
  const expenseTotals = Array.from({ length: 12 }, (_, mi) => expenseRows.reduce((s, r) => s + r.monthly[mi], 0))
  const netMonthly = Array.from({ length: 12 }, (_, mi) => incomeTotals[mi] - expenseTotals[mi])
  const runningBalance: number[] = []
  netMonthly.reduce((bal, net, mi) => {
    const end = bal + net
    runningBalance[mi] = end
    return end
  }, opening)

  async function saveOpeningBalance() {
    setSavingBalance(true)
    const { error } = await setOpeningBalance(year, Number(openingInput) || 0)
    setSavingBalance(false)
    if (error) { alert(error); return }
    setOpening(Number(openingInput) || 0)
  }

  function handleExportExcel() {
    const cols: ExportColumn<MatrixRow>[] = [
      { header: 'Nama', value: (r) => r.label },
      ...MONTH_NAMES.map((m, i): ExportColumn<MatrixRow> => ({ header: m, value: (r) => r.monthly[i] })),
    ]
    exportToExcel([...incomeRows, ...expenseRows], cols, `arus_kas_${year}`)
  }

  function handleExportPdf() {
    openPrintableReport({
      title: 'Arus Kas',
      subtitle: `Tahun ${year}`,
      meta: [
        { label: 'Cabang', value: branchName },
        { label: 'Saldo Awal', value: formatRp(opening) },
        { label: 'Saldo Akhir', value: formatRp(runningBalance[11] ?? opening) },
      ],
      columns: [
        { header: 'Bulan', value: (r: { label: string; income: number; expense: number; net: number; balance: number }) => r.label },
        { header: 'Pemasukan', align: 'right', value: (r) => formatRp(r.income) },
        { header: 'Pengeluaran', align: 'right', value: (r) => formatRp(r.expense) },
        { header: 'Laba Bersih', align: 'right', value: (r) => formatRp(r.net) },
        { header: 'Saldo Akhir', align: 'right', value: (r) => formatRp(r.balance) },
      ],
      rows: MONTH_NAMES.map((label, i) => ({
        label, income: incomeTotals[i], expense: expenseTotals[i], net: netMonthly[i], balance: runningBalance[i],
      })),
    })
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Tahun</label>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || year)} className={`${inputCls} w-28`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Saldo Awal (Rp)</label>
          <div className="flex gap-2">
            <input type="number" value={openingInput} onChange={(e) => setOpeningInput(e.target.value)} className={`${inputCls} w-40`} />
            <button onClick={saveOpeningBalance} disabled={savingBalance} className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors flex items-center gap-1.5">
              <Save size={14} /> Simpan
            </button>
          </div>
        </div>
        <div className="ml-auto">
          <ExportMenu onExportExcel={handleExportExcel} onExportPdf={handleExportPdf} disabled={loading} />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground sticky left-0 bg-card">Item</th>
                {MONTH_NAMES.map((m) => <th key={m} className="text-right px-3 py-2 font-medium text-muted-foreground">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border bg-muted/30"><td colSpan={13} className="px-3 py-1.5 font-semibold text-foreground">Pemasukan</td></tr>
              {incomeRows.map((r) => (
                <tr key={r.key} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-1.5 text-foreground sticky left-0 bg-card">{r.label}</td>
                  {r.monthly.map((v, i) => <td key={i} className="px-3 py-1.5 text-right text-muted-foreground">{v ? formatRp(v) : '—'}</td>)}
                </tr>
              ))}
              <tr className="border-b-2 border-border font-semibold">
                <td className="px-3 py-1.5 text-foreground sticky left-0 bg-card">Total Pemasukan</td>
                {incomeTotals.map((v, i) => <td key={i} className="px-3 py-1.5 text-right text-chart-4">{formatRp(v)}</td>)}
              </tr>

              <tr className="border-b border-border bg-muted/30"><td colSpan={13} className="px-3 py-1.5 font-semibold text-foreground">Pengeluaran</td></tr>
              {expenseRows.map((r) => (
                <tr key={r.key} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-1.5 text-foreground sticky left-0 bg-card">{r.label}</td>
                  {r.monthly.map((v, i) => <td key={i} className="px-3 py-1.5 text-right text-muted-foreground">{v ? formatRp(v) : '—'}</td>)}
                </tr>
              ))}
              <tr className="border-b-2 border-border font-semibold">
                <td className="px-3 py-1.5 text-foreground sticky left-0 bg-card">Total Pengeluaran</td>
                {expenseTotals.map((v, i) => <td key={i} className="px-3 py-1.5 text-right text-destructive">{formatRp(v)}</td>)}
              </tr>

              <tr className="border-b border-border font-semibold">
                <td className="px-3 py-1.5 text-foreground sticky left-0 bg-card">Laba Bersih</td>
                {netMonthly.map((v, i) => <td key={i} className={`px-3 py-1.5 text-right ${v >= 0 ? 'text-chart-4' : 'text-destructive'}`}>{formatRp(v)}</td>)}
              </tr>
              <tr className="font-bold">
                <td className="px-3 py-2 text-foreground sticky left-0 bg-card">Saldo Akhir</td>
                {runningBalance.map((v, i) => <td key={i} className="px-3 py-2 text-right text-primary">{formatRp(v)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
