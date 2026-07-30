import type { AdminStatus } from './types'
import { STATUS_LABEL, STATUS_BADGE } from './types'

export function StatusBadge({ status }: { status: AdminStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_BADGE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}
