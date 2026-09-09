'use client'

import { useMemo } from 'react'
import type { GriyaWeek, Discipline } from '@/app/actions/griyaJadwal'
import { GRIYA_HOURS, DISCIPLINE_SHORT, HARI_LABEL, JS_DAY_TO_HARI } from './constants'
import { resolveDay, type CellState } from './resolve'
import { addDays, toIso, isSameDay } from '@/components/jadwal/utils'

interface WeekEntry {
  key: string
  studentName: string
  patientId: string | null
  therapistNick: string
  discipline: Discipline
  state: CellState
}

const STATE_CLS: Record<string, string> = {
  scheduled: 'bg-primary/15 border-primary/50 text-foreground',
  hadir: 'bg-[#34C759] border-[#34C759] text-white',
  izin: 'bg-[#FFB35C]/25 border-[#FFB35C]/60 text-foreground',
  alpa: 'bg-[#FF3B30]/15 border-[#FF3B30]/60 text-foreground',
  adhoc: 'bg-purple-500/15 border-purple-500/60 text-foreground',
}

interface Props {
  week: GriyaWeek
  weekMonday: Date
  today: Date
  disciplineFilter: Discipline | 'ALL'
}

export function WeekGrid({ week, weekMonday, today, disciplineFilter }: Props) {
  const nickById = useMemo(() => {
    const m = new Map<string, { nick: string; discipline: Discipline }>()
    for (const t of week.therapists) m.set(t.therapist_id, { nick: t.nickname || t.full_name, discipline: t.discipline })
    return m
  }, [week.therapists])

  const days = useMemo(() => [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(weekMonday, n)), [weekMonday])

  // grid[hour][dayIndex] → entries
  const grid = useMemo(() => {
    const g = new Map<string, WeekEntry[][]>()
    for (const hour of GRIYA_HOURS) g.set(hour, days.map(() => []))

    days.forEach((d, di) => {
      const iso = toIso(d)
      const cells = resolveDay(week, iso)
      for (const cell of cells.values()) {
        if (cell.state === 'moved-out') continue
        const meta = nickById.get(cell.therapistId)
        const discipline = meta?.discipline ?? (cell.slot?.discipline as Discipline) ?? 'FISIOTERAPI'
        if (disciplineFilter !== 'ALL' && discipline !== disciplineFilter) continue
        const row = g.get(cell.hour)
        if (!row) continue
        row[di].push({
          key: cell.key + '|' + iso,
          studentName: cell.studentName,
          patientId: cell.slot?.patient_id ?? cell.visit?.patient_id ?? null,
          therapistNick: meta?.nick ?? '—',
          discipline,
          state: cell.state,
        })
      }
    })

    for (const rows of g.values()) {
      for (const list of rows) {
        list.sort((a, b) =>
          a.discipline.localeCompare(b.discipline) ||
          a.therapistNick.localeCompare(b.therapistNick) ||
          a.studentName.localeCompare(b.studentName),
        )
      }
    }
    return g
  }, [week, days, nickById, disciplineFilter])

  const perDayCount = useMemo(
    () => days.map((_, di) => GRIYA_HOURS.reduce((sum, h) => sum + (grid.get(h)?.[di].length ?? 0), 0)),
    [days, grid],
  )

  const dayColWidth = 190

  return (
    <div className="glass-card overflow-auto" style={{ maxHeight: 'calc(100vh - 15rem)' }}>
      <div style={{ minWidth: 72 + days.length * dayColWidth }}>
        {/* day headers */}
        <div className="flex sticky top-0 z-20 bg-background border-b border-border">
          <div className="w-[72px] shrink-0" />
          {days.map((d, i) => {
            const isTod = isSameDay(d, today)
            return (
              <div
                key={i}
                style={{ width: dayColWidth }}
                className={`px-2 py-2 text-center border-l border-border ${isTod ? 'bg-primary/10' : ''}`}
              >
                <div className={`text-[11px] font-semibold uppercase tracking-wide ${isTod ? 'text-primary' : 'text-foreground'}`}>
                  {HARI_LABEL[JS_DAY_TO_HARI[d.getDay()]]}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {d.getDate()}/{d.getMonth() + 1} · {perDayCount[i]} sesi
                </div>
              </div>
            )
          })}
        </div>

        {/* hour rows */}
        {GRIYA_HOURS.map((hour) => {
          const row = grid.get(hour) ?? []
          return (
            <div key={hour} className="flex border-b border-border/40">
              <div className="w-[72px] shrink-0 flex items-start justify-end pr-2 pt-2 text-[12px] font-mono text-muted-foreground">
                {hour}
              </div>
              {days.map((d, di) => {
                const entries = row[di] ?? []
                const isTod = isSameDay(d, today)
                return (
                  <div
                    key={di}
                    style={{ width: dayColWidth }}
                    className={`p-1.5 border-l border-border/40 space-y-1 ${isTod ? 'bg-primary/[0.04]' : ''}`}
                  >
                    {entries.map((e) => {
                      const cls = STATE_CLS[e.state] ?? STATE_CLS.scheduled
                      const inner = (
                        <>
                          <span className="block truncate font-medium">{e.studentName}</span>
                          <span className="block truncate text-[9px] opacity-80">
                            {e.therapistNick} · {DISCIPLINE_SHORT[e.discipline]}
                          </span>
                        </>
                      )
                      return e.patientId ? (
                        <a
                          key={e.key}
                          href={`/griya-anak/siswa/${e.patientId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`block rounded-lg border px-1.5 py-1 text-[11px] leading-tight ${cls} hover:opacity-90`}
                        >
                          {inner}
                        </a>
                      ) : (
                        <div
                          key={e.key}
                          className={`rounded-lg border px-1.5 py-1 text-[11px] leading-tight ${cls}`}
                        >
                          {inner}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
