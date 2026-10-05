'use client'

import { useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { TYPE_LABEL, type RegistrationFilterState, type StatusFilter, type TypeFilter } from './types'

interface Props {
  filters: RegistrationFilterState
  branches: { id: string; name: string }[]
  showBranch: boolean
  pendingCount: number
  onChange: (filters: RegistrationFilterState) => void
}

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Menunggu' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
  { value: 'all', label: 'Semua' },
]

export function RegistrationFilters({ filters, branches, showBranch, pendingCount, onChange }: Props) {
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearch(value: string) {
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => onChange({ ...filters, search: value }), 400)
  }

  useEffect(() => () => { if (searchRef.current) clearTimeout(searchRef.current) }, [])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => onChange({ ...filters, status: tab.value })}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filters.status === tab.value
                ? 'bg-primary text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.value === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 text-[11px] font-bold">({pendingCount})</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            defaultValue={filters.search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Cari nama, No. HP, orang tua, atau keluhan..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <select
          value={filters.type}
          onChange={e => onChange({ ...filters, type: e.target.value as TypeFilter })}
          className="px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {(Object.keys(TYPE_LABEL) as TypeFilter[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        {showBranch && (
          <select
            value={filters.branchId}
            onChange={e => onChange({ ...filters, branchId: e.target.value })}
            className="px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">Semua Cabang</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>
    </div>
  )
}
