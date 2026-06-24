'use client'

import { Repeat2 } from 'lucide-react'
import { DAY_CHIPS, addDays, toIso } from './constants'

const PAGI_HOURS = [8, 9, 10, 11, 12, 13]
const SORE_HOURS = [14, 15, 16, 17, 18, 19, 20]

function toHHMM(h: number) {
  return `${String(h).padStart(2, '0')}:00`
}

interface Props {
  targetDate: string
  recurDays: number[]
  recurEnd: string
  recurDates: string[]
  recurDayTimes: Record<number, string>
  onToggleDay: (dow: number) => void
  onSetEnd: (d: string) => void
  onSetDayTime: (dow: number, time: string) => void
}

export function RecurringConfig({ targetDate, recurDays, recurEnd, recurDates, recurDayTimes, onToggleDay, onSetEnd, onSetDayTime }: Props) {
  const minEnd = toIso(addDays(new Date(targetDate + 'T00:00:00'), 1))
  const dayLabels = DAY_CHIPS.filter((c) => recurDays.includes(c.dow)).map((c) => c.label).join(' & ')

  const selectedDays = DAY_CHIPS.filter((c) => recurDays.includes(c.dow))

  return (
    <div className="space-y-3 p-3 rounded-xl bg-white/5 border border-border/20">
      {/* Day picker */}
      <div>
        <p className="text-xs font-medium text-foreground mb-2">Hari</p>
        <div className="flex gap-1.5 flex-wrap">
          {DAY_CHIPS.map(({ dow, label }) => (
            <button
              key={dow}
              onClick={() => onToggleDay(dow)}
              className={[
                'w-10 h-10 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer border',
                recurDays.includes(dow)
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'border-border text-muted-foreground hover:bg-white/10 hover:text-foreground',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Per-day hour picker */}
      {selectedDays.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-foreground">Jam per Hari</p>
          {selectedDays.map(({ dow, label }) => {
            const selHour = recurDayTimes[dow]
              ? parseInt(recurDayTimes[dow].split(':')[0], 10)
              : null

            return (
              <div key={dow} className="rounded-xl border border-border/30 bg-white/3 p-2.5 space-y-2">
                <span className="text-[11px] font-bold text-primary uppercase tracking-wide">{label}</span>

                {/* PAGI row */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest w-7 shrink-0">Pagi</span>
                  <div className="flex gap-1 flex-wrap">
                    {PAGI_HOURS.map((h) => (
                      <button
                        key={h}
                        onClick={() => onSetDayTime(dow, toHHMM(h))}
                        className={[
                          'w-9 h-7 rounded-lg text-[11px] font-mono font-semibold transition-all duration-150 cursor-pointer border',
                          selHour === h
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'border-border/50 text-muted-foreground hover:bg-white/10 hover:text-foreground hover:border-border',
                        ].join(' ')}
                      >
                        {String(h).padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SORE row */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest w-7 shrink-0">Sore</span>
                  <div className="flex gap-1 flex-wrap">
                    {SORE_HOURS.map((h) => (
                      <button
                        key={h}
                        onClick={() => onSetDayTime(dow, toHHMM(h))}
                        className={[
                          'w-9 h-7 rounded-lg text-[11px] font-mono font-semibold transition-all duration-150 cursor-pointer border',
                          selHour === h
                            ? 'bg-secondary text-black border-secondary shadow-sm'
                            : 'border-border/50 text-muted-foreground hover:bg-white/10 hover:text-foreground hover:border-border',
                        ].join(' ')}
                      >
                        {String(h).padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selected time badge */}
                {selHour !== null && (
                  <div className="flex justify-end">
                    <span className={[
                      'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full',
                      selHour >= 14
                        ? 'bg-secondary/20 text-secondary'
                        : 'bg-primary/15 text-primary',
                    ].join(' ')}>
                      {toHHMM(selHour)}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* End date */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">
          Sampai Tanggal
        </label>
        <input
          type="date"
          value={recurEnd}
          min={minEnd}
          onChange={(e) => onSetEnd(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
        />
      </div>

      {/* Preview pill */}
      {recurDates.length > 0 ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
          <Repeat2 size={12} className="text-primary shrink-0" />
          <span className="text-xs font-semibold text-primary">
            {recurDates.length} sesi akan dibuat
          </span>
          {dayLabels && (
            <span className="text-xs text-muted-foreground">· {dayLabels}</span>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-1">
          Pilih hari dan tanggal akhir untuk melihat jadwal
        </p>
      )}
    </div>
  )
}
