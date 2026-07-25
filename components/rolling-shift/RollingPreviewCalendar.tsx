'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { previewTeamSchedule, type PreviewDay } from '@/app/actions/rollingShift'
import type { ShiftValue } from '@/lib/shift/rollingShift'

interface Props {
  teamId: string
  teamName: string
}

const SHIFT_BADGE: Record<ShiftValue, string> = {
  PAGI: 'bg-[color:var(--secondary)]/15 text-[color:var(--secondary)]',
  SORE: 'bg-primary/15 text-primary',
  OFF:  'bg-muted text-muted-foreground',
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const HARI_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

export function RollingPreviewCalendar({ teamId, teamName }: Props) {
  const [startDate, setStartDate] = useState(todayIso())
  const [days, setDays] = useState<PreviewDay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    previewTeamSchedule(teamId, startDate, addDays(startDate, 13)).then((d) => {
      if (!cancelled) { setDays(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [teamId, startDate])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Pratinjau Tim {teamName} (14 hari)</h4>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-2.5 py-1.5 border border-border rounded-lg text-xs bg-input focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const date = new Date(`${d.date}T00:00:00`)
            return (
              <div
                key={d.date}
                className={[
                  'rounded-lg border px-1.5 py-2 text-center',
                  d.isDerived ? 'border-dashed border-primary/40' : 'border-border',
                ].join(' ')}
                title={d.isDerived ? 'Dihitung otomatis dari shift Sabtu' : undefined}
              >
                <p className="text-[10px] text-muted-foreground">{HARI_SHORT[date.getDay()]} {date.getDate()}</p>
                <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${SHIFT_BADGE[d.shift]}`}>
                  {d.shift}
                </span>
                {d.isDerived && <p className="text-[9px] text-primary mt-0.5">otomatis</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
