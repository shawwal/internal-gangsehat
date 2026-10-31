'use client'

import { CalendarX2 } from 'lucide-react'
import { JadwalListRow, type EditField } from './JadwalListRow'
import type { JadwalListRow as Row } from './types'
import { ColumnFilter, filterOptions, type SortState } from '@/components/ui/ColumnFilter'
import { JADWAL_LIST_COLUMNS } from './columns'

interface Props {
  rows: Row[]
  loading: boolean
  page: number
  pageSize: number
  onRemind: (row: Row) => void
  onConfirm: (row: Row) => void
  onCancel: (row: Row) => void | Promise<void>
  fisioOptions: { value: string; label: string }[]
  onEdit: (row: Row, field: EditField, value: string) => Promise<void>
  /** Every loaded row (all pages) — the source of the column filter options */
  allRows: Row[]
  colFilters: Record<string, string[]>
  onColFilter: (key: string, values: string[]) => void
  colSort: SortState | null
  onColSort: (s: SortState | null) => void
}

// key → JADWAL_LIST_COLUMNS (sort); filter → multi-select on that column
const HEADERS: { label: string; key?: string; filter?: boolean }[] = [
  { label: 'No' }, { label: 'Tanggal', key: 'tanggal' }, { label: 'Jam', key: 'jam', filter: true },
  { label: 'Pasien', key: 'pasien', filter: true }, { label: 'Umur', key: 'umur' }, { label: 'Keluhan' },
  { label: 'Fisio', key: 'fisio', filter: true }, { label: 'Layanan', key: 'layanan', filter: true },
  { label: 'Kategori', key: 'kategori', filter: true }, { label: 'Pertemuan Ke', key: 'pertemuan', filter: true },
  { label: 'Kurang Bayar', key: 'kurang_bayar' }, { label: 'Kehadiran', key: 'kehadiran', filter: true },
  { label: 'Status', key: 'status', filter: true }, { label: 'Catatan Admin' }, { label: '' },
]

const th = 'px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap'

export function JadwalListTable({
  rows, loading, page, pageSize, onRemind, onConfirm, onCancel, fisioOptions, onEdit,
  allRows, colFilters, onColFilter, colSort, onColSort,
}: Props) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {HEADERS.map((h, i) => (
                <th key={i} className={th}>
                  <ColumnFilter
                    label={h.label}
                    sortKey={h.key}
                    sort={colSort}
                    onSort={onColSort}
                    options={h.filter && h.key ? filterOptions(allRows, (r) => String(JADWAL_LIST_COLUMNS[h.key!](r) ?? '—')) : undefined}
                    selected={h.key ? colFilters[h.key] : undefined}
                    onFilter={h.key ? (v) => onColFilter(h.key!, v) : undefined}
                  />
                </th>
              ))}
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
                onConfirm={onConfirm}
                onCancel={onCancel}
                fisioOptions={fisioOptions}
                onEdit={onEdit}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
