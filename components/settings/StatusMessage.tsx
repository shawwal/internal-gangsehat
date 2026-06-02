import type { StatusState } from './types'

interface Props {
  status: StatusState | null
}

export function StatusMessage({ status }: Props) {
  if (!status) return null
  return (
    <p
      role="status"
      aria-live="polite"
      className={`text-xs px-3 py-2 rounded-xl ${
        status.ok
          ? 'bg-chart-4/10 text-chart-4'
          : 'bg-destructive/10 text-destructive'
      }`}
    >
      {status.message}
    </p>
  )
}
