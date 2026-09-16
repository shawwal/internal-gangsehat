import { monthRange } from '@/components/finance/accounting/shared'
import type { DateRangeState } from './types'

function toInclusiveEnd(toExclusive: string): string {
  return new Date(new Date(toExclusive).getTime() - 86400000).toISOString().slice(0, 10)
}

export function defaultThisMonth(): DateRangeState {
  const now = new Date()
  const { from, toExclusive } = monthRange(now.getFullYear(), now.getMonth() + 1)
  return { from, to: toInclusiveEnd(toExclusive) }
}

export function defaultLastMonth(): DateRangeState {
  const now = new Date()
  const m = now.getMonth() === 0 ? 12 : now.getMonth()
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const { from, toExclusive } = monthRange(y, m)
  return { from, to: toInclusiveEnd(toExclusive) }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
