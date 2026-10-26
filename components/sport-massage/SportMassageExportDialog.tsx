'use client'

import { useState } from 'react'
import { FileDown, AlertTriangle, Loader2 } from 'lucide-react'
import { fetchSportMassageExportRows, type SportMassageExportRow } from '@/app/actions/sportMassageExport'
import { toIso } from '@/components/jadwal/utils'
import { useToast } from '@/context/ToastContext'
import { dateCell, money, slug, kehadiranLabel, VISIT_STATUS_LABEL, type Cell } from './xlsx'

interface Props {
  branchId: string | null
  branchName: string
  /** Date currently shown on the grid — the default range */
  initialDate: Date
  onClose: () => void
}

const COLUMNS: { header: string; width: number; value: (r: SportMassageExportRow, i: number) => Cell }[] = [
  { header: 'No',               width: 5,  value: (_, i) => i + 1 },
  { header: 'Tanggal',          width: 12, value: (r) => dateCell(r.visit_date) },
  { header: 'Jam',              width: 7,  value: (r) => r.visit_time ?? '' },
  { header: 'Nama Layanan',     width: 28, value: (r) => r.layanan ?? '' },
  { header: 'Kategori Layanan', width: 20, value: (r) => r.kategori ?? '' },
  { header: 'Nama Pasien',      width: 26, value: (r) => r.patient_name },
  { header: 'Status Kehadiran', width: 15, value: (r) => kehadiranLabel(r.kehadiran) },
  { header: 'Terapis',          width: 18, value: (r) => r.therapist_name ?? '' },
  { header: 'Status Jadwal',    width: 13, value: (r) => VISIT_STATUS_LABEL[r.status] ?? r.status },
  { header: 'No. RM',           width: 14, value: (r) => r.no_rm ?? '' },
  { header: 'No. HP',           width: 16, value: (r) => r.patient_phone },
  { header: 'Order ID',         width: 16, value: (r) => r.order_id ?? '' },
  { header: 'Sumber',           width: 10, value: (r) => (r.booking_source === 'online' ? 'Online' : 'Klinik') },
  { header: 'Harga',            width: 13, value: (r) => money(r.harga) },
  { header: 'Diskon',           width: 12, value: (r) => money(r.discount) },
  { header: 'Dibayar',          width: 13, value: (r) => money(r.dibayar) },
  { header: 'Kurang Bayar',     width: 14, value: (r) => money(r.kurang_bayar) },
  { header: 'Metode Bayar',     width: 18, value: (r) => r.payment_method ?? '' },
  { header: 'Status Bayar',     width: 13, value: (r) => r.payment_status ?? 'Belum Bayar' },
  { header: 'Keluhan',          width: 30, value: (r) => r.chief_complaint ?? '' },
  { header: 'Catatan',          width: 30, value: (r) => r.notes ?? '' },
]

const TOTAL_COLUMNS: { header: string; key: 'harga' | 'discount' | 'dibayar' | 'kurang_bayar' }[] = [
  { header: 'Harga', key: 'harga' },
  { header: 'Diskon', key: 'discount' },
  { header: 'Dibayar', key: 'dibayar' },
  { header: 'Kurang Bayar', key: 'kurang_bayar' },
]

function monthRange(d: Date, offset = 0) {
  const from = new Date(d.getFullYear(), d.getMonth() + offset, 1)
  const to   = new Date(d.getFullYear(), d.getMonth() + offset + 1, 0)
  return { from: toIso(from), to: toIso(to) }
}

export function SportMassageExportDialog({ branchId, branchName, initialDate, onClose }: Props) {
  const { showToast } = useToast()
  const [from, setFrom]           = useState(() => toIso(initialDate))
  const [to, setTo]               = useState(() => toIso(initialDate))
  const [exporting, setExporting] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  function applyPreset(range: { from: string; to: string }) {
    setFrom(range.from)
    setTo(range.to)
    setError(null)
  }

  async function handleExport() {
    if (exporting || !from || !to) return
    if (to < from) { setError('Tanggal akhir sebelum tanggal awal'); return }
    setExporting(true)
    setError(null)
    try {
      const rows = await fetchSportMassageExportRows(from, to, branchId)
      if (rows.length === 0) { setError('Tidak ada jadwal sport massage pada rentang ini'); return }

      const XLSX = await import('xlsx')
      const period = from === to ? from : `${from} s/d ${to}`
      const hadir = rows.filter((r) => r.kehadiran === 'HADIR').length
      const head: Cell[][] = [
        ['Jadwal Sport Massage'],
        ['Cabang', branchName || 'Semua cabang'],
        ['Periode', period],
        ['Jumlah kunjungan', rows.length],
        ['Hadir', hadir],
        [],
      ]
      const headerRow = head.length + 1 // 1-based row of the column headers
      const body = rows.map((r, i) => COLUMNS.map((c) => c.value(r, i)))
      const total: Cell[] = COLUMNS.map((c) => (c.header === 'No' ? 'TOTAL' : null))
      for (const t of TOTAL_COLUMNS) {
        total[COLUMNS.findIndex((c) => c.header === t.header)] = money(rows.reduce((s, r) => s + r[t.key], 0))
      }

      const ws = XLSX.utils.aoa_to_sheet([...head, COLUMNS.map((c) => c.header), ...body, [], total])
      ws['!cols'] = COLUMNS.map((c) => ({ wch: c.width }))
      ws['!autofilter'] = {
        ref: XLSX.utils.encode_range({ r: headerRow - 1, c: 0 }, { r: headerRow - 1 + body.length, c: COLUMNS.length - 1 }),
      }
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Sport Massage')
      XLSX.writeFile(wb, `sport-massage_${slug(branchName) || 'semua'}_${from}${to !== from ? `_${to}` : ''}.xlsx`, { compression: true })
      showToast(`${rows.length.toLocaleString('id-ID')} kunjungan diekspor`, 'success')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? `Gagal mengekspor: ${e.message}` : 'Gagal mengekspor')
    } finally {
      setExporting(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
  const presetCls = 'px-3 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors cursor-pointer'
  const today = new Date()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={exporting ? undefined : onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-sm shadow-2xl max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <FileDown size={16} className="text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Export Sport Massage</p>
            <p className="text-xs text-muted-foreground truncate">{branchName || 'Semua cabang'}</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => applyPreset({ from: toIso(today), to: toIso(today) })} className={presetCls}>Hari Ini</button>
            <button type="button" onClick={() => applyPreset(monthRange(today))} className={presetCls}>Bulan Ini</button>
            <button type="button" onClick={() => applyPreset(monthRange(today, -1))} className={presetCls}>Bulan Lalu</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Dari Tanggal</label>
              <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setError(null) }} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Sampai Tanggal</label>
              <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setError(null) }} className={inputCls} />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-destructive/8 border border-destructive/20">
              <AlertTriangle size={13} className="text-destructive shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || !from || !to}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {exporting ? <><Loader2 size={14} className="animate-spin" /> Mengekspor...</> : 'Export Excel'}
          </button>
        </div>
      </div>
    </div>
  )
}
