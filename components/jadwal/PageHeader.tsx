import { CalendarClock, RefreshCw } from 'lucide-react'
import { fmtHeaderDate } from './utils'

interface PageHeaderProps {
  date: Date
  loading: boolean
  onRefresh: () => void
}

export function PageHeader({ date, loading, onRefresh }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
          <CalendarClock size={18} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Jadwal Harian</h1>
          <p className="text-sm text-muted-foreground">{fmtHeaderDate(date)}</p>
        </div>
      </div>

      <button
        onClick={onRefresh}
        title="Refresh"
        className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
      </button>
    </div>
  )
}
