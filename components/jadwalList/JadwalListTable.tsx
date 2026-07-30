'use client'

import { CalendarX2 } from 'lucide-react'
import { JadwalListRow } from './JadwalListRow'
import type { JadwalListRow as Row } from './types'

interface Props {
  rows: Row[]
  loading: boolean
  page: number
  pageSize: number
  onRemind: (row: Row) => void
  onCancel: (row: Row) => void | Promise<void>
}

const HEADERS = [
  'No', 'Tanggal', 'Jam', 'Pasien', 'Umur', 'Keluhan', 'Fisio', 'Tipe Order',
  'Layanan', 'Pertemuan Ke', 'Kurang Bayar', 'Kehadiran', 'Status', 'Catatan Admin', '',
]

const th = 'px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap'

export function JadwalListTable({ rows, loading, page, pageSize, onRemind, onCancel }: Props) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {HEADERS.map((h) => <th key={h} className={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-border/50">
                {HEADERS.map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 bg-muted animate-pulse rounded-lg" />
                  </td>
                ))}
              </tr>
            ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={HEADERS.length} className="px-4 py-12 text-center text-muted-foreground">
                  <CalendarX2 size={28} className="mx-auto mb-2 opacity-50" />
                  Tidak ada kunjungan pada tanggal ini
                </td>
              </tr>
            )}

            {!loading && rows.map((row, i) => (
              <JadwalListRow
                key={row.id}
                row={row}
                no={(page - 1) * pageSize + i + 1}
                onRemind={onRemind}
                onCancel={onCancel}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
