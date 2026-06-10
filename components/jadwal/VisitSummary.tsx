import type { DailyVisit } from '@/app/actions/jadwal'
import type { DayStaffEntry } from './types'
import type { VisitStatus } from '@/types'
import { STATUS_BADGE } from './types'

const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  scheduled: 'Terjadwal',
  completed: 'Selesai',
  cancelled: 'Batal',
  no_show:   'Tdk Hadir',
}

interface VisitSummaryProps {
  visits: DailyVisit[]
  staff: DayStaffEntry[]
}

export function VisitSummary({ visits, staff }: VisitSummaryProps) {
  const counts = (['scheduled', 'completed', 'cancelled', 'no_show'] as VisitStatus[]).map((s) => ({
    status: s,
    count:  visits.filter((v) => v.status === s).length,
  }))

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground font-medium">
        {visits.length} kunjungan
      </span>
      {counts.filter((c) => c.count > 0).map(({ status, count }) => (
        <span
          key={status}
          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[status]}`}
        >
          {count} {VISIT_STATUS_LABELS[status]}
        </span>
      ))}
      {staff.length > 0 && (
        <span className="ml-auto text-xs text-muted-foreground">
          {staff.filter((s) => !s.isOnLeave).length} terapis aktif
          {staff.filter((s) => s.isOnLeave).length > 0 &&
            ` · ${staff.filter((s) => s.isOnLeave).length} cuti`}
        </span>
      )}
    </div>
  )
}
