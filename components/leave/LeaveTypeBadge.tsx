import { leaveTypeLabel } from './types'

export function LeaveTypeBadge({ type }: { type: string | null | undefined }) {
  return (
    <span className="text-xs font-medium text-secondary-foreground bg-secondary/20 px-2 py-0.5 rounded-full">
      {leaveTypeLabel(type)}
    </span>
  )
}
