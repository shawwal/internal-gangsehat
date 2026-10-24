'use client'

import { useOptimistic } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useFinancePending } from './FinancePending'
import { buildFinanceUrl, FINANCE_PERIOD_COOKIE, PERIOD_ALL_YEAR, PERIOD_SEMESTERS } from './types'
import { DateRangeFilter } from '@/components/finance/DateRangeFilter'

interface Branch { id: string; name: string }

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

interface Props {
  branches: Branch[]
  baseParams: Record<string, string>
  branchId: string
  showBranchSelect: boolean
  month: string
  year: string
  from: string
  to: string
}

export function FinanceFilterBar({ branches, baseParams, branchId: urlBranchId, showBranchSelect, month: urlMonth, year: urlYear, from: urlFrom, to: urlTo }: Props) {
  const router = useRouter()
  const { isPending, startTransition } = useFinancePending()
  const currentYear = new Date().getFullYear()

  // Selects show the new choice immediately while the page re-renders.
  type Filters = { branchId: string; month: string; year: string; from: string; to: string }
  const [{ branchId, month, year, from, to }, setOptimistic] = useOptimistic<Filters, Partial<Filters>>(
    { branchId: urlBranchId, month: urlMonth, year: urlYear, from: urlFrom, to: urlTo },
    (cur, next) => ({ ...cur, ...next }),
  )

  const hasRange = !!(from || to)

  function navigate(overrides: Partial<{ branch: string; month: string; year: string; from: string; to: string }>) {
    startTransition(() => {
      setOptimistic({
        ...('branch' in overrides ? { branchId: overrides.branch ?? '' } : {}),
        ...('month' in overrides ? { month: overrides.month ?? '' } : {}),
        ...('year' in overrides ? { year: overrides.year ?? '' } : {}),
        ...('from' in overrides ? { from: overrides.from ?? '' } : {}),
        ...('to' in overrides ? { to: overrides.to ?? '' } : {}),
      })
      router.push(buildFinanceUrl(baseParams, { ...overrides, page: undefined }))
    })
  }

  // Month/year and date range are alternative periods — picking one clears the other.
  function pickPeriod(overrides: { month?: string; year?: string }) {
    // Remember the month/semester choice in this browser (year isn't remembered).
    if (overrides.month) {
      document.cookie = `${FINANCE_PERIOD_COOKIE}=${overrides.month}; path=/; max-age=31536000; samesite=lax`
    }
    navigate({ month, year, ...overrides, from: undefined, to: undefined })
  }

  function pickRange(nextFrom: string, nextTo: string) {
    if (!nextFrom && !nextTo) navigate({ from: undefined, to: undefined, month: undefined, year: undefined })
    else navigate({ from: nextFrom, to: nextTo, month: undefined, year: undefined })
  }

  const cls = [
    'h-9 px-3 text-sm rounded-xl border border-white/10',
    'bg-white/5 text-foreground',
    'focus:outline-none focus:ring-2 focus:ring-primary/40',
    'cursor-pointer transition-colors',
  ].join(' ')

  return (
    <div className="flex items-center gap-2 flex-wrap" aria-busy={isPending}>
      {isPending && <Loader2 size={16} className="animate-spin text-primary" aria-label="Memuat" />}
      {/* Director-only: other roles are scoped to their own branch by RLS. */}
      {showBranchSelect && (
        <select className={cls} value={branchId} onChange={e => navigate({ branch: e.target.value })}>
          <option value="">Semua Cabang</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      )}

      <select className={cls} value={hasRange ? 'range' : month} onChange={e => pickPeriod({ month: e.target.value })}>
        {hasRange && <option value="range" disabled>Rentang tanggal</option>}
        <option value={PERIOD_ALL_YEAR}>Semua Bulan</option>
        {Object.entries(PERIOD_SEMESTERS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
        {MONTHS.map((name, i) => (
          <option key={i + 1} value={String(i + 1)}>{name}</option>
        ))}
      </select>

      <select className={cls} value={year} onChange={e => pickPeriod({ year: e.target.value })}>
        {[currentYear, currentYear - 1, currentYear - 2].map(y => (
          <option key={y} value={String(y)}>{y}</option>
        ))}
      </select>

      <DateRangeFilter from={from} to={to} onChange={pickRange} />
    </div>
  )
}
