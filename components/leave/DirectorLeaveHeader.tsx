import { CheckSquare } from 'lucide-react'

interface Props {
  loading: boolean
  hasRows: boolean
  selectMode: boolean
  todayLabel: string
  onToggleSelect: () => void
}

export function DirectorLeaveHeader({ loading, hasRows, selectMode, todayLabel, onToggleSelect }: Props) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Cuti Staff</h1>
        <p className="text-sm text-muted-foreground">Tinjau dan kelola pengajuan cuti seluruh cabang</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!loading && hasRows && (
          <button
            onClick={onToggleSelect}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              selectMode
                ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckSquare size={13} />
            {selectMode ? 'Selesai Pilih' : 'Pilih'}
          </button>
        )}
        <span className="text-xs bg-muted px-3 py-1.5 rounded-2xl text-muted-foreground">
          {todayLabel}
        </span>
      </div>
    </div>
  )
}
