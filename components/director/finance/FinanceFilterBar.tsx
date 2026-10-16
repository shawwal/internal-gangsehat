'use client'

import { useRouter } from 'next/navigation'
import { buildFinanceUrl } from './types'
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

export function FinanceFilterBar({ branches, baseParams, branchId, showBranchSelect, month, year, from, to }: Props) {
  const router = useRouter()
  const currentYear = new Date().getFullYear()

  const hasRange = !!(from || to)

  function navigate(overrides: Partial<{ branch: string; month: string; year: string; from: string; to: string }>) {
    router.push(buildFinanceUrl(baseParams, { ...overrides, page: undefined }))
  }

  // Month/year and date range are alternative periods — picking one clears the other.
  function pickPeriod(overrides: { month?: string; year?: string }) {
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
    <div className="flex items-center gap-2 flex-wrap">
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
        <option value="">Semua Bulan</option>
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
