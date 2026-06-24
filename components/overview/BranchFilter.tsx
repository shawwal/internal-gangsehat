'use client'

import { useRouter } from 'next/navigation'

interface Branch { id: string; name: string }

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

interface Props {
  branches: Branch[]
  branchId: string
  month: string
  year: string
}

export function BranchFilter({ branches, branchId, month, year }: Props) {
  const router = useRouter()
  const currentYear = new Date().getFullYear()

  function navigate(next: Partial<{ branch: string; month: string; year: string }>) {
    const b = next.branch !== undefined ? next.branch : branchId
    const m = next.month  !== undefined ? next.month  : month
    const y = next.year   !== undefined ? next.year   : year
    const sp = new URLSearchParams()
    if (b) sp.set('branch', b)
    if (m) sp.set('month', m)
    if (y) sp.set('year', y)
    router.push(`/director/overview?${sp.toString()}`)
  }

  const cls = [
    'h-9 px-3 text-sm rounded-xl border border-border',
    'bg-background text-foreground',
    'focus:outline-none focus:ring-2 focus:ring-primary/40',
    'cursor-pointer transition-colors',
  ].join(' ')

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select className={cls} value={branchId} onChange={e => navigate({ branch: e.target.value })}>
        <option value="">Semua Cabang</option>
        {branches.map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>

      <select className={cls} value={month} onChange={e => navigate({ month: e.target.value })}>
        <option value="">Semua Bulan</option>
        {MONTHS.map((name, i) => (
          <option key={i + 1} value={String(i + 1)}>{name}</option>
        ))}
      </select>

      <select className={cls} value={year} onChange={e => navigate({ year: e.target.value })}>
        {[currentYear, currentYear - 1, currentYear - 2].map(y => (
          <option key={y} value={String(y)}>{y}</option>
        ))}
      </select>
    </div>
  )
}
