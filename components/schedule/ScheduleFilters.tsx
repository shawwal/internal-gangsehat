'use client'

import { Search } from 'lucide-react'
import { HARI_LIST, SHIFT_LIST, PAGE_SIZES } from './constants'
import { WEEK_GROUP_LIST, WEEK_GROUP_LABEL } from '@/lib/schedule/weekGroup'

interface Props {
  search: string
  hariFilter: string
  shiftFilter: string
  weekGroupFilter: string
  pageSize: number
  onSearch: (v: string) => void
  onHari: (v: string) => void
  onShift: (v: string) => void
  onWeekGroup: (v: string) => void
  onPageSize: (v: number) => void
}

export function ScheduleFilters({
  search, hariFilter, shiftFilter, weekGroupFilter, pageSize,
  onSearch, onHari, onShift, onWeekGroup, onPageSize,
}: Props) {
  const selectCls =
    'px-3 py-2 border border-border rounded-xl text-sm bg-input cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[180px]">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Cari nama staff..."
          className="w-full pl-8 pr-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <select value={hariFilter} onChange={(e) => onHari(e.target.value)} className={selectCls}>
        <option value="">Semua Hari</option>
        {HARI_LIST.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>

      <select value={shiftFilter} onChange={(e) => onShift(e.target.value)} className={selectCls}>
        <option value="">Semua Shift</option>
        {SHIFT_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <select value={weekGroupFilter} onChange={(e) => onWeekGroup(e.target.value)} className={selectCls}>
        <option value="">Semua Minggu</option>
        {WEEK_GROUP_LIST.map((w) => <option key={w} value={w}>{WEEK_GROUP_LABEL[w]}</option>)}
      </select>

      <div className="flex items-center gap-2 ml-auto">
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className={selectCls}
        >
          {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-sm text-muted-foreground">data</span>
      </div>
    </div>
  )
}
