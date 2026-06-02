'use client'

import { RefreshCw, Loader2, CopyPlus } from 'lucide-react'
import type { PayrollFiltersState } from './types'
import { MONTHS } from './types'

interface Props {
  filters: PayrollFiltersState
  onFilterChange: (patch: Partial<PayrollFiltersState>) => void
  isManager: boolean
  generating: boolean
  onGenerate: () => void
  copying: boolean
  onCopyFromPrev: () => void
}

export function PayrollPeriodBar({
  filters,
  onFilterChange,
  isManager,
  generating,
  onGenerate,
  copying,
  onCopyFromPrev,
}: Props) {
  const prevMonth = filters.month === 1 ? 12 : filters.month - 1
  const prevYear  = filters.month === 1 ? filters.year - 1 : filters.year
  const prevLabel = `${MONTHS[prevMonth - 1]} ${prevYear}`

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
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

      {/* Action buttons — director only */}
      {!isManager && (
        <div className="flex items-center gap-2">
          {/* Primary: copy from previous month */}
          <button
            onClick={onCopyFromPrev}
            disabled={copying || generating}
            title={`Salin data dari ${prevLabel}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {copying
              ? <Loader2 size={14} className="animate-spin" />
              : <CopyPlus size={14} />}
            {copying ? 'Menyalin...' : `Salin dari ${prevLabel}`}
          </button>

          {/* Secondary: generate fresh (rarely needed) */}
          <button
            onClick={onGenerate}
            disabled={generating || copying}
            title="Generate penggajian baru dari formula"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium text-foreground/60 hover:bg-muted hover:text-foreground disabled:opacity-60 transition-colors"
          >
            {generating
              ? <Loader2 size={13} className="animate-spin" />
              : <RefreshCw size={13} />}
            {generating ? 'Memproses...' : 'Generate'}
          </button>
        </div>
      )}
    </div>
  )
}
