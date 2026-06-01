'use client'

import { useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import type { TargetFilters, BranchOption, StatusFilter } from './types'
import { MONTHS } from './types'

interface Props {
  filters: TargetFilters
  branches: BranchOption[]
  pendingCount: number
  onChange: (filters: TargetFilters) => void
}

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
]

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => String(currentYear - i))

export function TargetFilters({ filters, branches, pendingCount, onChange }: Props) {
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearch(value: string) {
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => {
      onChange({ ...filters, search: value })
    }, 400)
  }

  useEffect(() => () => { if (searchRef.current) clearTimeout(searchRef.current) }, [])

  return (
    <div className="space-y-3">
      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => onChange({ ...filters, status: tab.value })}
            className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              filters.status === tab.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {tab.label}
            {tab.value === 'pending' && pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search + dropdowns */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama atau email..."
            defaultValue={filters.search}
            onChange={e => handleSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <select
          value={filters.branchId}
          onChange={e => onChange({ ...filters, branchId: e.target.value })}
          className="px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua Cabang</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          value={filters.month}
          onChange={e => onChange({ ...filters, month: e.target.value })}
          className="px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua Bulan</option>
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={String(i + 1)}>{m}</option>
          ))}
        </select>

        <select
          value={filters.year}
          onChange={e => onChange({ ...filters, year: e.target.value })}
          className="px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua Tahun</option>
          {YEARS.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
