'use client'

import { useEffect, useRef } from 'react'
import { ArrowDownAZ, ArrowUpAZ, Search } from 'lucide-react'
import type { BranchOption, StaffOption } from '@/app/actions/medicalRecords'
import { COMPLETENESS_TABS, PERIOD_OPTIONS, type RecordFiltersState } from './types'

interface Props {
  filters: RecordFiltersState
  isTeamView: boolean
  isDirector: boolean
  branches: BranchOption[]
  staff: StaffOption[]
  incompleteCount: number
  onChange: (filters: RecordFiltersState) => void
}

const selectCls = 'px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer'

export function MedicalRecordsFilters({ filters, isTeamView, isDirector, branches, staff, incompleteCount, onChange }: Props) {
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearch(value: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => onChange({ ...filters, search: value }), 400)
  }

  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current) }, [])

  return (
    <div className="space-y-3">
      {/* Completeness tabs */}
      <div className="flex flex-wrap gap-2">
        {COMPLETENESS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onChange({ ...filters, completeness: tab.value })}
            className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              filters.completeness === tab.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {tab.label}
            {tab.value === 'incomplete' && incompleteCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {incompleteCount > 9 ? '9+' : incompleteCount}
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
            placeholder="Cari nama pasien..."
            defaultValue={filters.search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {isTeamView && isDirector && (
          <select
            value={filters.branchId}
            onChange={(e) => onChange({ ...filters, branchId: e.target.value })}
            className={selectCls}
          >
            <option value="all">Semua Cabang</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}

        {isTeamView && (
          <select
            value={filters.staffId}
            onChange={(e) => onChange({ ...filters, staffId: e.target.value })}
            className={selectCls}
          >
            <option value="all">Semua Terapis</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        )}

        <select
          value={filters.period}
          onChange={(e) => onChange({ ...filters, period: e.target.value as RecordFiltersState['period'] })}
          className={selectCls}
        >
          {PERIOD_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        <button
          type="button"
          onClick={() => onChange({ ...filters, sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
          title={filters.sortOrder === 'asc' ? 'Terlama lebih dulu' : 'Terbaru lebih dulu'}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          {filters.sortOrder === 'asc' ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
          {filters.sortOrder === 'asc' ? 'Terlama' : 'Terbaru'}
        </button>
      </div>
    </div>
  )
}
