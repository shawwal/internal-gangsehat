'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { X } from 'lucide-react'

const INPUT = 'h-9 min-w-0 flex-1 sm:flex-none px-3 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors cursor-pointer dark:[color-scheme:dark]'

// A native date input reports intermediate values while the year is being
// typed digit by digit (0002 → 0020 → 0202 → 2026). Only a plausible full
// date is committed; anything else stays a local draft.
const isCompleteDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 2000

function openPicker(e: React.MouseEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) {
  try { e.currentTarget.showPicker?.() } catch { /* unsupported or not user-activated */ }
}

interface Props {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}

/** Two date inputs (YYYY-MM-DD); empty = unbounded on that side. */
export function DateRangeFilter({ from, to, onChange }: Props) {
  // Local drafts so typing/navigation doesn't fight the committed props.
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo]     = useState(to)
  const [synced, setSynced]       = useState({ from, to })
  if (synced.from !== from || synced.to !== to) {
    // Props changed from outside (navigation, reset) — adopt them.
    setSynced({ from, to })
    setDraftFrom(from)
    setDraftTo(to)
  }

  function commit(nextFrom: string, nextTo: string) {
    // Picked in the wrong order → swap rather than return nothing.
    if (nextFrom && nextTo && nextFrom > nextTo) [nextFrom, nextTo] = [nextTo, nextFrom]
    if (nextFrom === from && nextTo === to) return
    setDraftFrom(nextFrom)
    setDraftTo(nextTo)
    onChange(nextFrom, nextTo)
  }

  function handleChange(side: 'from' | 'to', value: string) {
    if (side === 'from') setDraftFrom(value)
    else setDraftTo(value)
    const nextFrom = side === 'from' ? value : draftFrom
    const nextTo   = side === 'to'   ? value : draftTo
    // Commit when this side is complete or cleared; the other side must be too.
    const ok = (v: string) => v === '' || isCompleteDate(v)
    if (ok(value) && ok(nextFrom) && ok(nextTo)) commit(nextFrom, nextTo)
  }

  return (
    <div className="flex items-center gap-1.5 w-full sm:w-auto min-w-0">
      <input
        type="date"
        aria-label="Dari tanggal"
        value={draftFrom}
        onChange={(e) => handleChange('from', e.target.value)}
        onClick={openPicker}
        className={INPUT}
      />
      <span className="text-xs text-muted-foreground">–</span>
      <input
        type="date"
        aria-label="Sampai tanggal"
        value={draftTo}
        min={isCompleteDate(draftFrom) ? draftFrom : undefined}
        onChange={(e) => handleChange('to', e.target.value)}
        onClick={openPicker}
        className={INPUT}
      />
      {(from || to || draftFrom || draftTo) && (
        <button
          type="button"
          onClick={() => { setDraftFrom(''); setDraftTo(''); if (from || to) onChange('', '') }}
          title="Hapus filter tanggal"
          className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
