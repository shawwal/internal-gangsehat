'use client'

import type { CellObject } from 'xlsx'
import { ExportButton } from '@/components/ui/ExportButton'
import { useToast } from '@/context/ToastContext'
import { STATUS_LABEL, type JadwalListRow } from './types'

interface Props {
  /** Every row matching the current filters (all pages, not just the visible one) */
  rows: JadwalListRow[]
  branchName: string
  dateFrom: string
  dateTo: string
  /** Human-readable active filters, for the header block */
  filters: string[]
}

type Cell = CellObject | string | number | null

/** YYYY-MM-DD → Excel serial date (timezone-free, so it never shifts a day). */
function dateCell(iso: string): CellObject | string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const serial = (Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86_400_000
  return { t: 'n', v: serial, z: 'dd/mm/yyyy' }
}

function slug(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const KEHADIRAN_LABEL: Record<string, string> = { HADIR: 'Hadir', 'TIDAK HADIR': 'Tidak Hadir' }

const COLUMNS: { header: string; width: number; value: (r: JadwalListRow, i: number) => Cell }[] = [
  { header: 'No',            width: 5,  value: (_, i) => i + 1 },
  { header: 'Tanggal',       width: 12, value: (r) => dateCell(r.visit_date) },
  { header: 'Jam',           width: 7,  value: (r) => r.visit_time ?? '' },
  { header: 'Pasien',        width: 26, value: (r) => r.patient_name },
  { header: 'Umur',          width: 8,  value: (r) => r.patient_age ?? '' },
  { header: 'Keluhan',       width: 30, value: (r) => r.chief_complaint ?? '' },
  { header: 'Fisio',         width: 18, value: (r) => r.attending_staff_name ?? '' },
  { header: 'Layanan',       width: 16, value: (r) => r.layanan_label ?? '' },
  { header: 'Tarif Layanan', width: 26, value: (r) => r.tarif_nama ?? '' },
  { header: 'Pertemuan Ke',  width: 12, value: (r) => r.pertemuan_ke },
  { header: 'Kurang Bayar',  width: 14, value: (r) => ({ t: 'n', v: r.kurang_bayar, z: '#,##0' }) },
  { header: 'Kehadiran',     width: 12, value: (r) => (r.kehadiran ? KEHADIRAN_LABEL[r.kehadiran] ?? r.kehadiran : 'Belum Diisi') },
  { header: 'Status',        width: 16, value: (r) => STATUS_LABEL[r.admin_status] },
  { header: 'Order ID',      width: 16, value: (r) => r.order_id ?? '' },
  { header: 'Catatan Admin', width: 30, value: (r) => r.notes ?? '' },
]

export function JadwalListExportButton({ rows, branchName, dateFrom, dateTo, filters }: Props) {
  const { showToast } = useToast()

  async function handleExport() {
    if (rows.length === 0) {
      showToast('Tidak ada jadwal untuk diekspor', 'error')
      return
    }
    try {
      const XLSX = await import('xlsx')
      const period = dateFrom === dateTo ? dateFrom : `${dateFrom} s/d ${dateTo}`
      const head: Cell[][] = [
        ['Jadwal Harian'],
        ['Cabang', branchName],
        ['Periode', period],
        ['Filter', filters.length ? filters.join(' · ') : 'Tidak ada'],
        ['Jumlah kunjungan', rows.length],
        [],
      ]
      const headerRow = head.length + 1 // 1-based row of the column headers
      const body = rows.map((r, i) => COLUMNS.map((c) => c.value(r, i)))
      const total: Cell[] = COLUMNS.map((c) => (c.header === 'No' ? 'TOTAL' : null))
      const kbCol = COLUMNS.findIndex((c) => c.header === 'Kurang Bayar')
      total[kbCol] = { t: 'n', v: rows.reduce((s, r) => s + r.kurang_bayar, 0), z: '#,##0' }

      const ws = XLSX.utils.aoa_to_sheet([...head, COLUMNS.map((c) => c.header), ...body, [], total])
      ws['!cols'] = COLUMNS.map((c) => ({ wch: c.width }))
      ws['!autofilter'] = {
        ref: XLSX.utils.encode_range({ r: headerRow - 1, c: 0 }, { r: headerRow - 1 + body.length, c: COLUMNS.length - 1 }),
      }
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Jadwal')
      XLSX.writeFile(wb, `jadwal_${slug(branchName) || 'semua'}_${dateFrom}${dateTo !== dateFrom ? `_${dateTo}` : ''}.xlsx`, { compression: true })
      showToast(`${rows.length.toLocaleString('id-ID')} kunjungan diekspor`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? `Gagal mengekspor: ${e.message}` : 'Gagal mengekspor', 'error')
    }
  }

  return <ExportButton onExport={handleExport} label="Export Excel" />
}
