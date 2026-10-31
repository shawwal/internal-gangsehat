'use client'

// Table-header control: click the column name to sort, the funnel to filter by
// one or more values. The panel is position: fixed so scrolling tables don't
// clip it. Pure UI — the table owns sort/filter state (see `useColumnFilters`).

import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Filter, Search } from 'lucide-react'

export type SortDir = 'asc' | 'desc'
export interface SortState { key: string; dir: SortDir }

export interface FilterOption {
  value: string
  label?: string
  count?: number
}

interface Props {
  label: string
  /** Sort key; omit for a non-sortable column */
  sortKey?: string
  sort?: SortState | null
  onSort?: (s: SortState | null) => void
  /** Distinct values to filter on; omit for a non-filterable column */
  options?: FilterOption[]
  selected?: string[]
  onFilter?: (values: string[]) => void
  align?: 'left' | 'right' | 'center'
}

export function ColumnFilter({ label, sortKey, sort, onSort, options, selected = [], onFilter, align = 'left' }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const sortedHere = sortKey && sort?.key === sortKey ? sort.dir : null
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (options ?? []).filter((o) => !q || (o.label ?? o.value).toLowerCase().includes(q))
  }, [options, query])

  function cycleSort() {
    if (!sortKey || !onSort) return
    onSort(sortedHere === 'asc' ? { key: sortKey, dir: 'desc' } : sortedHere === 'desc' ? null : { key: sortKey, dir: 'asc' })
  }

  function openPanel(e: React.MouseEvent) {
    e.stopPropagation()
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left - 120, window.innerWidth - 248)) })
    setQuery('')
    setOpen(true)
  }

  function toggle(v: string) {
    onFilter?.(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])
  }

  const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'

  return (
    <div className={`flex items-center gap-1 ${justify}`}>
      <button
        type="button"
        onClick={cycleSort}
        disabled={!sortKey}
        className="inline-flex items-center gap-1 font-medium disabled:cursor-default hover:text-foreground"
      >
        {label}
        {sortKey && (sortedHere === 'asc' ? <ArrowUp size={11} /> : sortedHere === 'desc' ? <ArrowDown size={11} /> : <ArrowUpDown size={11} className="opacity-40" />)}
      </button>
      {options && (
        <button
          ref={btnRef}
          type="button"
          onClick={openPanel}
          aria-label={`Filter ${label}`}
          className={`p-0.5 rounded hover:bg-muted ${selected.length ? 'text-primary' : 'opacity-50 hover:opacity-100'}`}
        >
          <Filter size={11} />
          {selected.length > 0 && <span className="sr-only">{selected.length} dipilih</span>}
        </button>
      )}

      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[310]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[311] w-60 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl p-2 text-xs font-normal normal-case tracking-normal"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-muted mb-1.5">
              <Search size={12} className="opacity-60" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari…"
                className="bg-transparent outline-none flex-1 min-w-0"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {list.length === 0 && <p className="px-2 py-2 text-muted-foreground">Tidak ada pilihan</p>}
              {list.map((o) => {
                const on = selected.includes(o.value)
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggle(o.value)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted text-left"
                  >
                    <span className={`w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center ${on ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                      {on && <Check size={10} />}
                    </span>
                    <span className="flex-1 truncate">{o.label ?? o.value}</span>
                    {o.count != null && <span className="text-muted-foreground">{o.count}</span>}
                  </button>
                )
              })}
            </div>
            <div className="flex justify-between gap-2 pt-1.5 mt-1.5 border-t border-border">
              <button type="button" className="px-2 py-1 rounded-lg hover:bg-muted" onClick={() => onFilter?.(list.map((o) => o.value))}>
                Pilih semua
              </button>
              <button type="button" className="px-2 py-1 rounded-lg hover:bg-muted text-muted-foreground" onClick={() => onFilter?.([])}>
                Reset
              </button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}

/** Distinct values of `get` over `rows`, with counts, sorted by label. */
export function filterOptions<T>(rows: T[], get: (r: T) => string | null | undefined, label?: (v: string) => string): FilterOption[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const v = get(r) ?? '—'
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, label: label?.(value) ?? value }))
    .sort((a, b) => a.label.localeCompare(b.label, 'id'))
}

/**
 * Client-side filter + sort for a table: `columns` maps a key to the cell value
 * used for both. Rows match when every filtered column's value is selected.
 */
export function applyColumnFilters<T>(
  rows: T[],
  columns: Record<string, (r: T) => string | number | null | undefined>,
  filters: Record<string, string[]>,
  sort: SortState | null,
): T[] {
  const active = Object.entries(filters).filter(([k, v]) => v.length > 0 && columns[k])
  let out = active.length
    ? rows.filter((r) => active.every(([k, vals]) => vals.includes(String(columns[k](r) ?? '—'))))
    : rows
  if (sort && columns[sort.key]) {
    const get = columns[sort.key]
    const mul = sort.dir === 'asc' ? 1 : -1
    out = [...out].sort((a, b) => {
      const x = get(a), y = get(b)
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'id')) * mul
    })
  }
  return out
}
