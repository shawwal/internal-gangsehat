import { CalendarOff } from 'lucide-react'
import { LeaveCard } from './LeaveCard'
import type { LeaveRow } from './types'

interface Props {
  loading: boolean
  rows: LeaveRow[]
  totalStats: number
  selectMode: boolean
  selected: Set<string>
  onToggle: (id: string) => void
  onApprove: (id: string) => Promise<void>
  onReject: (id: string, note: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function DirectorLeaveList({
  loading, rows, totalStats, selectMode, selected,
  onToggle, onApprove, onReject, onDelete,
}: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-muted rounded-3xl h-24" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 px-4 bg-muted/30 rounded-3xl gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <CalendarOff size={22} className="text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground">
          {totalStats === 0 ? 'Belum ada pengajuan cuti' : 'Tidak ada hasil yang cocok'}
        </p>
        <p className="text-xs text-muted-foreground text-center">
          {totalStats === 0
            ? 'Pengajuan cuti dari staff semua cabang akan muncul di sini.'
            : 'Coba ubah kata kunci pencarian atau filter.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map(leave => (
        <LeaveCard
          key={leave.id}
          leave={leave}
          isSelected={selectMode ? selected.has(leave.id) : undefined}
          onToggle={selectMode ? onToggle : undefined}
          onApprove={onApprove}
          onReject={onReject}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
