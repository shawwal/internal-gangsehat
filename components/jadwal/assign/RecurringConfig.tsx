'use client'

import { Repeat2 } from 'lucide-react'
import { DAY_CHIPS, addDays, toIso } from './constants'

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

      {/* Per-day time inputs */}
      {recurDays.length > 0 && (
        <div>
          <p className="text-xs font-medium text-foreground mb-2">Jam per Hari</p>
          <div className="space-y-2">
            {DAY_CHIPS.filter((c) => recurDays.includes(c.dow)).map(({ dow, label }) => (
              <div key={dow} className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-center text-xs font-bold text-primary">{label}</span>
                <input
                  type="time"
                  value={recurDayTimes[dow] ?? '08:00'}
                  onChange={(e) => onSetDayTime(dow, e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
                />
              </div>
            ))}
          </div>
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
