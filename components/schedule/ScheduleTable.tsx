'use client'

import { CalendarDays, Pencil, Trash2 } from 'lucide-react'
import type { ScheduleRow } from './types'

// ── Badges ───────────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: 'AKTIF' | 'OFF' }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold tracking-wider ${
        status === 'AKTIF' ? 'bg-[#34C759] text-white' : 'bg-[#FF3B30] text-white'
      }`}
    >
      {status === 'AKTIF' ? 'MASUK' : 'OFF'}
    </span>
  )
}

export function ShiftBadge({ shift }: { shift: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        shift === 'PAGI'
          ? 'bg-(--secondary)/20 text-secondary'
          : 'bg-primary/10 text-primary'
      }`}
    >
      {shift}
    </span>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-border last:border-0">
      {[24, 12, 120, 64, 48, 52, 52, 60, 40].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-3.5 bg-muted animate-pulse rounded-md" style={{ width: `${w}px` }} />
        </td>
      ))}
    </tr>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number
  total: number
  pageSize: number
  onPage: (p: number) => void
}

function Pagination({ page, total, pageSize, onPage }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const fromIdx    = total === 0 ? 0 : page * pageSize + 1
  const toIdx      = Math.min(page * pageSize + pageSize, total)

  function pageNums(): (number | '...')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i)
    const nums: (number | '...')[] = [0]
    if (page > 2) nums.push('...')
    for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) nums.push(i)
    if (page < totalPages - 3) nums.push('...')
    nums.push(totalPages - 1)
    return nums
  }

  const btnCls =
    'w-8 h-8 flex items-center justify-center rounded-lg text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer'

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border">
      <p className="text-sm text-muted-foreground">
        {fromIdx} – {toIdx} dari {total} data
      </p>
      <div className="flex items-center gap-0.5">
        <button onClick={() => onPage(0)} disabled={page === 0} className={btnCls}>«</button>
        <button onClick={() => onPage(page - 1)} disabled={page === 0} className={btnCls}>‹</button>
        {pageNums().map((p, i) =>
          p === '...' ? (
            <span key={`e-${i}`} className="w-8 h-8 flex items-center justify-center text-sm text-muted-foreground">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                page === p ? 'bg-primary text-white' : 'hover:bg-muted text-foreground'
              }`}
            >
              {(p as number) + 1}
            </button>
          ),
        )}
        <button onClick={() => onPage(page + 1)} disabled={page >= totalPages - 1} className={btnCls}>›</button>
        <button onClick={() => onPage(totalPages - 1)} disabled={page >= totalPages - 1} className={btnCls}>»</button>
      </div>
    </div>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────

interface Props {
  rows: ScheduleRow[]
  loading: boolean
  page: number
  pageSize: number
  total: number
  search: string
  hariFilter: string
  shiftFilter: string
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  onEdit: (row: ScheduleRow) => void
  onDelete: (id: string) => void
  onPage: (p: number) => void
}

export function ScheduleTable({
  rows, loading, page, pageSize, total,
  search, hariFilter, shiftFilter,
  selectedIds, onSelectionChange,
  onEdit, onDelete, onPage,
}: Props) {
  const pageIds = rows.map((r) => r.id)
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id))
  const someSelected = pageIds.some((id) => selectedIds.includes(id))

  function toggleAll() {
    if (allSelected) {
      onSelectionChange(selectedIds.filter((id) => !pageIds.includes(id)))
    } else {
      const merged = Array.from(new Set([...selectedIds, ...pageIds]))
      onSelectionChange(merged)
    }
  }

  function toggleRow(id: string) {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((s) => s !== id))
    } else {
      onSelectionChange([...selectedIds, id])
    }
  }

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-170 text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {/* Select-all checkbox */}
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded cursor-pointer accent-primary"
                  aria-label="Pilih semua di halaman ini"
                />
              </th>
              <th className="w-12 px-4 py-3 text-xs font-semibold text-muted-foreground text-left">NO</th>
              <th className="px-4 py-3 text-xs font-semibold text-muted-foreground text-left">NAMA STAFF</th>
              <th className="w-24 px-4 py-3 text-xs font-semibold text-muted-foreground text-left">HARI</th>
              <th className="w-20 px-4 py-3 text-xs font-semibold text-muted-foreground text-left">SHIFT</th>
              <th className="w-28 px-4 py-3 text-xs font-semibold text-muted-foreground text-left">JAM MULAI</th>
              <th className="w-28 px-4 py-3 text-xs font-semibold text-muted-foreground text-left">JAM SELESAI</th>
              <th className="w-28 px-4 py-3 text-xs font-semibold text-muted-foreground text-left">KETERANGAN</th>
              <th className="w-20 px-4 py-3 text-xs font-semibold text-muted-foreground text-left"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: Math.min(pageSize, 6) }).map((_, i) => <SkeletonRow key={i} />)
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <CalendarDays size={22} className="text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Belum ada jadwal</p>
                    <p className="text-xs text-muted-foreground">
                      {search || hariFilter || shiftFilter
                        ? 'Tidak ada jadwal yang sesuai filter'
                        : 'Klik Tambah untuk menambahkan jadwal baru'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const isSelected = selectedIds.includes(row.id)
                return (
                  <tr
                    key={row.id}
                    className={[
                      'border-b border-border last:border-0 transition-colors',
                      isSelected
                        ? 'bg-primary/5 border-l-2 border-l-primary'
                        : 'hover:bg-muted/30',
                    ].join(' ')}
                  >
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(row.id)}
                        className="w-4 h-4 rounded cursor-pointer accent-primary"
                        aria-label={`Pilih ${row.internal_profiles?.full_name ?? 'jadwal ini'}`}
                      />
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">{page * pageSize + idx + 1}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-foreground">
                        {row.internal_profiles?.full_name ?? '—'}
                      </span>
                      {row.branches?.name && (
                        <span className="ml-2 text-xs text-muted-foreground">{row.branches.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-foreground">{row.hari}</td>
                    <td className="px-4 py-3.5"><ShiftBadge shift={row.shift} /></td>
                    <td className="px-4 py-3.5 font-mono text-foreground">{row.jam_mulai?.slice(0, 5) ?? '—'}</td>
                    <td className="px-4 py-3.5 font-mono text-foreground">{row.jam_selesai?.slice(0, 5) ?? '—'}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEdit(row)}
                          title="Edit jadwal"
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => onDelete(row.id)}
                          title="Hapus jadwal"
                          className="p-1.5 rounded-lg hover:bg-[#FF3B30]/10 text-muted-foreground hover:text-[#FF3B30] transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {!loading && total > 0 && (
        <Pagination page={page} total={total} pageSize={pageSize} onPage={onPage} />
      )}
    </div>
  )
}
