'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Search, Receipt } from 'lucide-react'
import { fetchPatientNames } from '@/app/actions/patients'
import type { AccountingTxnRow } from '@/app/actions/accounting'
import { exportToExcel, type ExportColumn } from '@/lib/excel-export'
import { formatRp, formatNum } from './shared'

interface Props {
  title: string
  subtitle?: string
  rows: AccountingTxnRow[]
  adminName: (id: string | null) => string
  onClose: () => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Drill-down list behind a Laporan number — the same rows that produced it. */
export function TransactionDetailModal({ title, subtitle, rows, adminName, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [patientNames, setPatientNames] = useState<Record<string, string>>({})
  const [namesLoading, setNamesLoading] = useState(() => rows.some((r) => r.patient_id))

  // Mounted only while open, so search/name state starts fresh for each drill-down.
  useEffect(() => {
    const ids = rows.map((r) => r.patient_id).filter((id): id is string => !!id)
    if (!ids.length) return
    fetchPatientNames(ids)
      .then((names) => setPatientNames(names))
      .finally(() => setNamesLoading(false))
  }, [rows])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)),
    [rows],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((t) =>
      [
        t.patient_id ? patientNames[t.patient_id] : '',
        t.description, t.category, t.payment_method, t.payment_status, adminName(t.fisio_id),
      ].some((v) => v?.toLowerCase().includes(q)),
    )
  }, [sorted, search, patientNames, adminName])

  const total = filtered.reduce((s, t) => s + (t.type === 'expense' ? -1 : 1) * Number(t.amount), 0)
  const patientLabel = (t: AccountingTxnRow) => (t.patient_id ? (patientNames[t.patient_id] ?? (namesLoading ? '…' : '—')) : '—')

  function handleExport() {
    const cols: ExportColumn<AccountingTxnRow>[] = [
      { header: 'Tanggal', value: (t) => t.transaction_date },
      { header: 'Jenis', value: (t) => (t.type === 'income' ? 'Pemasukan' : 'Pengeluaran') },
      { header: 'Kategori', value: (t) => t.category },
      { header: 'Pasien', value: (t) => (t.patient_id ? patientNames[t.patient_id] ?? '' : '') },
      { header: 'Keterangan', value: (t) => t.description ?? '' },
      { header: 'Fisio', value: (t) => adminName(t.fisio_id) },
      { header: 'Metode', value: (t) => t.payment_method ?? '' },
      { header: 'Status Bayar', value: (t) => t.payment_status ?? '' },
      { header: 'Status', value: (t) => t.status },
      { header: 'Harga', value: (t) => Number(t.harga) },
      { header: 'Diskon', value: (t) => Number(t.discount) },
      { header: 'Nominal', value: (t) => Number(t.amount) },
    ]
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    exportToExcel(filtered, cols, `detail_${slug}_${new Date().toISOString().slice(0, 10)}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-card relative w-full sm:max-w-4xl flex flex-col max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-primary/10 shrink-0">
              <Receipt size={16} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
              <p className="text-xs text-muted-foreground truncate">
                {subtitle ? `${subtitle} · ` : ''}{formatNum(rows.length)} transaksi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleExport} disabled={!filtered.length}
              className="px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50">
              Excel
            </button>
            <button onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-background/60">
            <Search size={13} className="text-muted-foreground shrink-0" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari pasien, keterangan, kategori, fisio, metode..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
            {search && (
              <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {search ? `Tidak ada hasil untuk "${search}"` : 'Tidak ada transaksi'}
            </p>
          ) : (
            <table className="w-full text-sm min-w-[720px]">
              <thead className="sticky top-0 bg-background/95 backdrop-blur">
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Tanggal</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Kategori</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Pasien / Keterangan</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Fisio</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Pembayaran</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{formatDate(t.transaction_date)}</td>
                    <td className="px-4 py-2 text-foreground">
                      {t.category}
                      {t.status === 'pending' && (
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary-foreground">pending</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {t.patient_id && <p className="text-foreground">{patientLabel(t)}</p>}
                      {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                      {!t.patient_id && !t.description && <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{t.fisio_id ? adminName(t.fisio_id) : '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      <p>{t.payment_method ?? '—'}</p>
                      {t.payment_status && <p className="text-xs">{t.payment_status}</p>}
                    </td>
                    <td className={`px-4 py-2 text-right font-medium whitespace-nowrap ${t.type === 'expense' ? 'text-destructive' : 'text-chart-4'}`}>
                      {t.type === 'expense' ? '−' : ''}{formatRp(Number(t.amount))}
                      {Number(t.discount) > 0 && (
                        <p className="text-xs font-normal text-muted-foreground">diskon {formatRp(Number(t.discount))}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0 text-sm">
          <span className="text-muted-foreground">
            {search ? `${formatNum(filtered.length)} dari ${formatNum(rows.length)} transaksi` : `${formatNum(rows.length)} transaksi`}
          </span>
          <span className="font-semibold text-foreground">Total {formatRp(total)}</span>
        </div>
      </div>
    </div>
  )
}
