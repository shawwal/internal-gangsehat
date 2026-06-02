'use client'

import { RefreshCw, Loader2 } from 'lucide-react'
import type { PayrollFiltersState } from './types'
import { MONTHS } from './types'

interface Props {
  filters: PayrollFiltersState
  onFilterChange: (patch: Partial<PayrollFiltersState>) => void
  isManager: boolean
  generating: boolean
  onGenerate: () => void
}

export function PayrollPeriodBar({ filters, onFilterChange, isManager, generating, onGenerate }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Period selectors */}
      <div className="flex items-center gap-2">
        <select
          value={filters.month}
          onChange={e => onFilterChange({ month: +e.target.value })}
          className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <input
          type="number"
          value={filters.year}
          min={2020}
          max={2099}
          onChange={e => onFilterChange({ year: +e.target.value })}
          className="w-24 px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Generate button — director only */}
      {!isManager && (
        <button
          onClick={onGenerate}
          disabled={generating}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {generating
            ? <Loader2 size={14} className="animate-spin" />
            : <RefreshCw size={14} />}
          {generating ? 'Memproses...' : 'Generate Penggajian'}
        </button>
      )}
    </div>
  )
}
