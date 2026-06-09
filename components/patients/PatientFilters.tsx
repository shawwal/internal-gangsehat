'use client'

import {
  ArrowDownAZ, ArrowUpAZ, CalendarArrowDown, CalendarArrowUp,
  LayoutGrid, Table2, Search, ArrowDownUp,
} from 'lucide-react'
import type { PatientFiltersState, SortField, ViewMode } from './types'
import { GENDER_TABS } from './types'

interface Props {
  filters:    PatientFiltersState
  viewMode:   ViewMode
  total:      number
  filtered:   number
  onChange:   (f: PatientFiltersState) => void
  onViewMode: (mode: ViewMode) => void
}

const SORT_FIELDS: { value: SortField; label: string }[] = [
  { value: 'created_at', label: 'Tanggal Daftar' },
  { value: 'name',       label: 'Nama' },
  { value: 'no_rm',      label: 'No. RM' },
]

function SortIcon({ field, order }: { field: SortField; order: 'asc' | 'desc' }) {
  if (field === 'name' || field === 'no_rm') {
    return order === 'asc'
      ? <ArrowDownAZ size={15} className="text-foreground" />
      : <ArrowUpAZ size={15} className="text-foreground" />
  }
  return order === 'asc'
    ? <CalendarArrowDown size={15} className="text-foreground" />
    : <CalendarArrowUp size={15} className="text-foreground" />
}

export function PatientFilters({ filters, viewMode, total, filtered, onChange, onViewMode }: Props) {
  const showCount = total > 0 && (filters.search || filters.gender !== 'all')

  return (
    <div className="space-y-3">
      {/* Gender tabs */}
      <div className="flex flex-wrap gap-2">
        {GENDER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => onChange({ ...filters, gender: tab.key })}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
              filters.gender === tab.key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {tab.label}
          </button>
        ))}

        {showCount && (
          <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-secondary/20 text-secondary-foreground">
            {filtered} dari {total} pasien
          </span>
        )}
      </div>

      {/* Search + sort + view toggle row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            value={filters.search}
            onChange={e => onChange({ ...filters, search: e.target.value })}
            placeholder="Cari nama atau telepon..."
            className="w-full pl-8 pr-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Hapus pencarian"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {/* Sort field */}
        <select
          value={filters.sortField}
          onChange={e => onChange({ ...filters, sortField: e.target.value as SortField })}
          className="px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          aria-label="Urut berdasarkan"
        >
          {SORT_FIELDS.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        {/* Sort order toggle */}
        <button
          onClick={() => onChange({ ...filters, sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
          className="p-2 rounded-xl border border-border hover:bg-muted transition-colors cursor-pointer"
          title={filters.sortOrder === 'asc' ? 'Ascending — klik untuk descending' : 'Descending — klik untuk ascending'}
          aria-label="Toggle urutan"
        >
          <SortIcon field={filters.sortField} order={filters.sortOrder} />
        </button>

        {/* View toggle */}
        <div
          className="flex items-center gap-0.5 p-1 rounded-xl border border-border bg-muted/40"
          role="group"
          aria-label="Pilih tampilan"
        >
          <button
            onClick={() => onViewMode('grid')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Tampilan Kartu"
            aria-label="Tampilan kartu"
            aria-pressed={viewMode === 'grid'}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => onViewMode('table')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Tampilan Tabel"
            aria-label="Tampilan tabel"
            aria-pressed={viewMode === 'table'}
          >
            <Table2 size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
