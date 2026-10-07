'use client'

import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { fetchTargetProgressDetail, type TargetProgressDetailRow } from '@/app/actions/targetProgress'
import { EditTransactionSheet } from '@/components/director/finance/EditTransactionSheet'
import { PAY_STATUS_BADGE, formatRp } from '@/components/director/finance/types'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportToExcel, type ExportColumn } from '@/lib/excel-export'
import type { CategoryKey } from './types'

// "Sab 27 Sep 2026" — matches the Tanggal column of the clinic's visit log.
function formatExportDate(date: string): string {
  return new Date(date + 'T00:00:00')
    .toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    .replace(',', '')
}

const KUNJUNGAN_EXPORT_COLUMNS: ExportColumn<TargetProgressDetailRow>[] = [
  { header: 'Tanggal',          value: (r) => (r.visitDate ? formatExportDate(r.visitDate) : '') },
  { header: 'Jam',              value: (r) => r.visitTime?.slice(0, 5) },
  { header: 'Nama Pasien',      value: (r) => r.patientName },
  { header: 'Nama Terapis',     value: (r) => r.fisioNickname ?? r.fisioName },
  { header: 'Layanan',          value: (r) => r.serviceType },
  { header: 'Pertemuan Ke',     value: (r) => r.pertemuanKe },
  // Rows with no recorded kehadiran are past visits the target counts as attended.
  { header: 'Kehadiran',        value: (r) => (r.kehadiran === 'HADIR' ? 'Hadir' : 'Belum Dicatat') },
  { header: 'Status Kunjungan', value: (r) => r.statusKunjungan },
]

interface DetailModalProps {
  open: boolean
  onClose: () => void
  branchId: string
  date: string | null
  // Set for a whole-period list (Capaian column); omitted for a single day.
  endDate?: string | null
  category: CategoryKey | null
  label: string
  canEdit: boolean
  onDataChanged?: () => void
}

export function DetailModal({ open, onClose, branchId, date, endDate, category, label, canEdit, onDataChanged }: DetailModalProps) {
  const [rows, setRows] = useState<TargetProgressDetailRow[]>([])
  const [loading, setLoading] = useState(false)
  const [editingRow, setEditingRow] = useState<TargetProgressDetailRow | null>(null)

  function refetch() {
    if (!date || !category) return
    setLoading(true)
    fetchTargetProgressDetail(branchId, date, category, endDate ?? date)
      .then(setRows)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!open || !date || !category) return
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, endDate, category, branchId])

  if (!open) return null

  const isRange = !!endDate && endDate !== date
  const fmtLong = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
  const dateLabel = date ? (isRange ? `${fmtLong(date)} – ${fmtLong(endDate!)}` : fmtLong(date)) : ''
  const fmtShort = (d?: string) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '—'

  function handleExport() {
    exportToExcel(rows, KUNJUNGAN_EXPORT_COLUMNS, isRange ? `kunjungan_${date}_${endDate}` : `kunjungan_${date}`)
    return Promise.resolve()
  }

  function handleSaved() {
    setEditingRow(null)
    refetch()
    onDataChanged?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl flex flex-col max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl bg-popover border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Detail {label}</h2>
            <p className="text-xs text-muted-foreground">{dateLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            {category === 'kunjungan' && (
              <ExportButton onExport={handleExport} disabled={loading || rows.length === 0} />
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Memuat data...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {isRange ? 'Tidak ada data pada periode ini' : 'Tidak ada data pada tanggal ini'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  {[
                    'No.',
                    ...(isRange ? ['Tanggal'] : []),
                    'Nama Pasien',
                    'Layanan',
                    ...(category === 'kunjungan' ? ['Waktu', 'Fisio'] : rows.some((r) => r.tx) ? ['Nominal', 'Pembayaran'] : []),
                  ].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-b border-border/25 transition-colors ${
                      canEdit && r.tx ? 'hover:bg-muted/30 cursor-pointer' : 'hover:bg-muted/20'
                    }`}
                    onClick={canEdit && r.tx ? () => setEditingRow(r) : undefined}
                  >
                    <td className="px-4 py-2.5 text-xs text-muted-foreground w-10">{i + 1}</td>
                    {isRange && (
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtShort(r.visitDate)}</td>
                    )}
                    <td className="px-4 py-2.5 text-xs font-medium text-foreground">{r.patientName}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {r.packageName ? `${r.packageName}${r.jenisPaket ? ` (${r.jenisPaket})` : ''}` : (r.serviceType ?? '—')}
                    </td>
                    {r.tx ? (
                      <>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{formatRp(r.tx.harga ?? 0)}</td>
                        <td className="px-4 py-2.5 text-xs">
                          {r.tx.payment_status && (
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold ${PAY_STATUS_BADGE[r.tx.payment_status] ?? ''}`}>
                              {r.tx.payment_status}
                            </span>
                          )}
                        </td>
                      </>
                    ) : category === 'kunjungan' && (
                      <>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.visitTime ?? '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.fisioName}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer count */}
        {!loading && rows.length > 0 && (
          <div className="px-5 py-3 border-t border-border shrink-0 text-center">
            <p className="text-xs text-muted-foreground">
              {rows.length} {category === 'kunjungan' ? 'kunjungan' : 'transaksi'}
              {canEdit && rows.some((r) => r.tx) ? ' — klik baris untuk edit/hapus' : ''}
            </p>
          </div>
        )}
      </div>

      {editingRow?.tx && (
        <EditTransactionSheet
          transaction={editingRow.tx}
          open
          hideTrigger
          onOpenChange={(next) => { if (!next) setEditingRow(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
