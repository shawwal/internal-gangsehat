'use client'

import { YEARS } from './utils'
import type { Branch } from './types'

interface PerformanceFiltersProps {
  year: number
  setYear: (y: number) => void
  branchFilter: string
  setBranchFilter: (b: string) => void
  branches: Branch[]
}

const selectCls =
  'h-8 px-2.5 rounded-xl text-sm border border-border bg-card text-foreground ' +
  'focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors hover:border-primary/50'

export function PerformanceFilters({
  year,
  setYear,
  branchFilter,
  setBranchFilter,
  branches,
}: PerformanceFiltersProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={branchFilter}
        onChange={e => setBranchFilter(e.target.value)}
        className={selectCls}
      >
        <option value="all">Semua Cabang</option>
        {branches.map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>

      <select
        value={year}
        onChange={e => setYear(Number(e.target.value))}
        className={selectCls}
      >
        {YEARS.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  )
}
