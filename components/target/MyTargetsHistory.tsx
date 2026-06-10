import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MyTargetCard } from './MyTargetCard'
import type { TargetRow, StatusFilter } from './types'
import { STATUS_LABEL } from './types'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
]

interface Props {
  targets: TargetRow[]
  viewYear: number
  maxYear: number
  activeTab: StatusFilter
  pendingCount: number
  onYearChange: (year: number) => void
  onTabChange: (tab: StatusFilter) => void
  onEdit: (target: TargetRow) => void
}

export function MyTargetsHistory({
  targets,
  viewYear,
  maxYear,
  activeTab,
  pendingCount,
  onYearChange,
  onTabChange,
  onEdit,
}: Props) {
  const yearTargets = targets.filter(t => t.tahun === viewYear)
  const filtered = activeTab === 'all'
    ? yearTargets
    : yearTargets.filter(t => t.status === activeTab)

  return (
    <div className="space-y-4">
      {/* Section header + year navigator */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Riwayat Target</h2>
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
          <button
            onClick={() => onYearChange(viewYear - 1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2 text-sm font-medium text-foreground min-w-[3rem] text-center">
            {viewYear}
          </span>
          <button
            onClick={() => onYearChange(viewYear + 1)}
            disabled={viewYear >= maxYear}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      {yearTargets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => onTabChange(tab.value)}
              className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeTab === tab.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tab.label}
              {tab.value === 'pending' && pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Cards / empty states */}
      {yearTargets.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-10 bg-muted/30 rounded-3xl">
          Tidak ada target untuk tahun {viewYear}.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-10 bg-muted/30 rounded-3xl">
          Tidak ada target dengan status &quot;{STATUS_LABEL[activeTab]}&quot;.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => (
            <MyTargetCard key={t.id} target={t} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  )
}
