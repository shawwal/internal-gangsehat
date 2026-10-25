'use client'

import { useState } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import type { CellObject, WorkSheet } from 'xlsx'
import { ExportButton } from '@/components/ui/ExportButton'
import { fetchFinanceExport, type FinanceExportData } from '@/app/(dashboard)/director/finance/actions'
import { TX_STATUS_LABEL, type TransactionRow } from './types'

interface Props {
  baseParams: Record<string, string>
  /** Display name of the therapist filter, if any (for the summary sheet) */
  therapistName?: string
}

const RP = '#,##0'
const DATE = 'dd/mm/yyyy'

type Cell = CellObject | string | number | null

const num = (v: number | null | undefined, z = RP): CellObject => ({ t: 'n', v: Number(v ?? 0), z })

/** YYYY-MM-DD → Excel serial date (timezone-free, so it never shifts a day). */
function dateCell(iso: string): CellObject | string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const serial = (Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86_400_000
  return { t: 'n', v: serial, z: DATE }
}

function colLetter(i: number) {
  let s = ''
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s
  return s
}

function slug(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function activeFilters(p: Record<string, string>, therapistName?: string): string[] {
  const out: string[] = []
  if (p.tx_type)    out.push(`Jenis: ${p.tx_type === 'income' ? 'Pemasukan' : 'Pengeluaran'}`)
  if (p.status)     out.push(`Status: ${TX_STATUS_LABEL[p.status] ?? p.status}`)
  if (p.pay_status) out.push(`Status bayar: ${p.pay_status}`)
  if (p.category)   out.push(`Layanan: ${p.category}`)
  if (p.therapist)  out.push(`Terapis: ${therapistName ?? '—'}`)
  if (p.no_patient) out.push('Hanya transaksi tanpa pasien')
  if (p.q)          out.push(`Pencarian: "${p.q}"`)
  return out
}

const TX_COLUMNS: { header: string; width: number; value: (r: TransactionRow) => Cell; sum?: boolean }[] = [
  { header: 'Tanggal',      width: 12, value: r => dateCell(r.transaction_date) },
  { header: 'Cabang',       width: 18, value: r => r.branch_name },
  { header: 'Jenis',        width: 12, value: r => (r.type === 'income' ? 'Pemasukan' : 'Pengeluaran') },
  { header: 'Kategori',     width: 18, value: r => r.category },
  { header: 'Layanan',      width: 24, value: r => r.service_name ?? '' },
  { header: 'Pasien',       width: 24, value: r => r.patient_name ?? '' },
  { header: 'Terapis',      width: 20, value: r => r.therapist?.name ?? '' },
  { header: 'Penjamin',     width: 14, value: r => r.penjamin ?? '' },
  { header: 'Harga',        width: 14, value: r => num(r.harga),       sum: true },
  { header: 'Diskon',       width: 12, value: r => num(r.discount),    sum: true },
  { header: 'Dibayar',      width: 14, value: r => num(r.amount),      sum: true },
  { header: 'Sisa Tagihan', width: 14, value: r => num(r.outstanding), sum: true },
  { header: 'Metode Bayar', width: 18, value: r => r.payment_method ?? '' },
  { header: 'Status Bayar', width: 13, value: r => r.payment_status ?? '' },
  { header: 'Status',       width: 13, value: r => TX_STATUS_LABEL[r.status] ?? r.status },
  { header: 'Keterangan',   width: 36, value: r => r.description ?? '' },
]

export function FinanceExportButton({ baseParams, therapistName }: Props) {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  async function handleExport() {
    setResult(null)
    try {
      const data = await fetchFinanceExport(baseParams)
      if (data.txns.length === 0) {
        setResult({ ok: false, text: 'Tidak ada transaksi untuk diekspor' })
      } else {
        await writeWorkbook(data, activeFilters(baseParams, therapistName))
        setResult({ ok: true, text: `${data.txns.length.toLocaleString('id-ID')} transaksi diekspor` })
      }
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? `Gagal mengekspor: ${e.message}` : 'Gagal mengekspor' })
    }
    setTimeout(() => setResult(null), 5000)
  }

  return (
    <div className="flex items-center gap-2">
      <ExportButton onExport={handleExport} label="Export Excel" />
      {result && (
        <span
          role="status"
          className={`flex items-center gap-1 text-xs font-medium ${result.ok ? 'text-[#34C759]' : 'text-destructive'}`}
        >
          {result.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
          {result.text}
        </span>
      )}
    </div>
  )
}

async function writeWorkbook(data: FinanceExportData, filters: string[]) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const exportedAt = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

  // ── Sheet 1: Ringkasan (header info + KPI + per-branch) ────────────────────
  const info: Cell[][] = [
    ['Laporan Keuangan Cabang'],
    [],
    ['Cabang', data.branchName],
    ['Periode', data.periodLabel],
    ['Filter', filters.length ? filters.join(' · ') : 'Tidak ada'],
    ['Jumlah transaksi', data.txns.length],
    ['Diekspor', exportedAt],
  ]
  if (data.totals) {
    const t = data.totals
    info.push(
      [],
      ['Ringkasan (tidak termasuk transaksi ditolak)'],
      ['Pendapatan', num(t.income)],
      ['Terkumpul', num(t.collected)],
      ['Belum dibayar', num(t.outstanding)],
      ['Pengeluaran', num(t.expense)],
      ['Laba bersih', num(t.net)],
    )
    if (t.branches.length > 1) {
      info.push(
        [],
        ['Per Cabang'],
        ['Cabang', 'Pendapatan', 'Terkumpul', 'Belum dibayar', 'Pengeluaran', 'Laba bersih'],
        ...t.branches.map(b => [b.name, num(b.income), num(b.collected), num(b.outstanding), num(b.expense), num(b.net)]),
        ['TOTAL', num(t.income), num(t.collected), num(t.outstanding), num(t.expense), num(t.net)],
      )
    }
  }
  const summary = XLSX.utils.aoa_to_sheet(info)
  summary['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }]
  summary['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }]
  XLSX.utils.book_append_sheet(wb, summary, 'Ringkasan')

  // ── Sheet 2: Transaksi (one row per transaction + total row) ───────────────
  const header = TX_COLUMNS.map(c => c.header)
  const body = data.txns.map(r => TX_COLUMNS.map(c => c.value(r)))
  const lastRow = body.length + 1 // 1-based row of the last data row
  const totalRow: Cell[] = TX_COLUMNS.map((c, i) => {
    if (i === 0) return 'TOTAL'
    if (!c.sum) return null
    const col = colLetter(i)
    const v = data.txns.reduce((sum, r) => sum + Number((c.value(r) as CellObject).v ?? 0), 0)
    return { t: 'n', v, z: RP, f: body.length ? `SUM(${col}2:${col}${lastRow})` : undefined }
  })
  const ws: WorkSheet = XLSX.utils.aoa_to_sheet([header, ...body, ...(body.length ? [[], totalRow] : [])])
  ws['!cols'] = TX_COLUMNS.map(c => ({ wch: c.width }))
  ws['!autofilter'] = { ref: `A1:${colLetter(TX_COLUMNS.length - 1)}${Math.max(lastRow, 1)}` }
  XLSX.utils.book_append_sheet(wb, ws, 'Transaksi')

  const today = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `keuangan_${slug(data.branchName)}_${slug(data.periodLabel)}_${today}.xlsx`, { compression: true })
}
