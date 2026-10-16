'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { X } from 'lucide-react'

const INPUT = 'h-9 px-3 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors'

interface Props {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}

/** Two date inputs (YYYY-MM-DD); empty = unbounded on that side. */
export function DateRangeFilter({ from, to, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        aria-label="Dari tanggal"
        value={from}
        max={to || undefined}
        onChange={(e) => onChange(e.target.value, to)}
        className={INPUT}
      />
      <span className="text-xs text-muted-foreground">–</span>
      <input
        type="date"
        aria-label="Sampai tanggal"
        value={to}
        min={from || undefined}
        onChange={(e) => onChange(from, e.target.value)}
        className={INPUT}
      />
      {(from || to) && (
        <button
          type="button"
          onClick={() => onChange('', '')}
          title="Hapus filter tanggal"
          className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

/** DateRangeFilter backed by `?from=&to=` search params (server-rendered pages). */
export function UrlDateRangeFilter({ from, to }: { from: string; to: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function navigate(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextFrom) params.set('from', nextFrom)
    else params.delete('from')
    if (nextTo) params.set('to', nextTo)
    else params.delete('to')
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return <DateRangeFilter from={from} to={to} onChange={navigate} />
}
