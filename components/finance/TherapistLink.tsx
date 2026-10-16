'use client'

import Link from 'next/link'

/** Lives under /finance/transactions so the existing nav permissions cover it. */
export function therapistTransactionsHref(staffId: string, range?: { from?: string; to?: string }) {
  const p = new URLSearchParams()
  if (range?.from) p.set('from', range.from)
  if (range?.to)   p.set('to', range.to)
  const qs = p.toString()
  return `/finance/transactions/terapis/${staffId}${qs ? `?${qs}` : ''}`
}

interface Props {
  therapist: { id: string; name: string } | null | undefined
  /** Carry the source page's period over, so the drill-down shows the same window. */
  range?: { from?: string; to?: string }
  className?: string
}

export function TherapistLink({ therapist, range, className }: Props) {
  if (!therapist) return <span className="text-muted-foreground/40">—</span>
  return (
    <Link
      href={therapistTransactionsHref(therapist.id, range)}
      // Rows on some tables are clickable themselves (e.g. Piutang → settle dialog)
      onClick={(e) => e.stopPropagation()}
      className={className ?? 'hover:text-primary hover:underline underline-offset-2 transition-colors'}
    >
      {therapist.name}
    </Link>
  )
}
