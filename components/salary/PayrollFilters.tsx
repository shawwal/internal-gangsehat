'use client'

import type { PayrollFiltersState, PayrollStats, PayrollStatus } from './types'

interface Props {
  filters: PayrollFiltersState
  onFilterChange: (patch: Partial<PayrollFiltersState>) => void
  stats: PayrollStats
  branches: { id: string; name: string }[]
  isManager: boolean
}

const STATUS_OPTIONS: { value: PayrollStatus; label: string; statKey?: keyof PayrollStats }[] = [
  { value: 'all',       label: 'Semua' },
  { value: 'draft',     label: 'Draft',         statKey: 'draft' },
  { value: 'confirmed', label: 'Dikonfirmasi',  statKey: 'confirmed' },
  { value: 'paid',      label: 'Dibayar',       statKey: 'paid' },
]

export function PayrollFilters({ filters, onFilterChange, stats, branches, isManager }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status pills */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_OPTIONS.map(opt => {
          const count = opt.statKey ? stats[opt.statKey] : 0
          return (
            <button
              key={opt.value}
              onClick={() => onFilterChange({ status: opt.value })}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filters.status === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {opt.label}
              {opt.statKey && count > 0 && (
                <span className="ml-1 opacity-70">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Branch dropdown — director only */}
      {!isManager && branches.length > 0 && (
        <select
          value={filters.branchId}
          onChange={e => onFilterChange({ branchId: e.target.value })}
          className="px-3 py-1.5 border border-border rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua Cabang</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}
