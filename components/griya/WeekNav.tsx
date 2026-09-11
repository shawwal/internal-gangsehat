'use client'

import { useRef } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, toIso, getMondayOf } from '@/components/jadwal/utils'

interface Props {
  selectedDate: Date
  today: Date
  onSelect: (d: Date) => void
}

/** Week-level nav for the weekly overview: prev/next week, jump to any week,
 *  back to this week. No per-day chips — picking a day within the same week
 *  wouldn't change anything since the whole week is always shown. */
export function WeekNav({ selectedDate, today, onSelect }: Props) {
  const dateInputRef = useRef<HTMLInputElement>(null)
  const weekMonday   = getMondayOf(selectedDate)
  const weekEnd      = addDays(weekMonday, 6)
  const isCurrentWeek = getMondayOf(today).getTime() === weekMonday.getTime()

  return (
    <div className="glass-card p-3 flex items-center gap-2">
      <button
        onClick={() => onSelect(addDays(weekMonday, -7))}
        aria-label="Minggu sebelumnya"
        className="p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="flex-1 text-center text-sm font-medium text-foreground">
        {weekMonday.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
        {' – '}
        {weekEnd.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
      </div>

      <button
        onClick={() => onSelect(addDays(weekMonday, 7))}
        aria-label="Minggu berikutnya"
        className="p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
      >
        <ChevronRight size={16} />
      </button>

      <div className="relative shrink-0">
        <button
          onClick={() => dateInputRef.current?.showPicker()}
          title="Pilih minggu"
          aria-label="Pilih minggu"
          className="p-2 rounded-xl border border-border hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <Calendar size={15} />
        </button>
        <input
          ref={dateInputRef}
          type="date"
          value={toIso(selectedDate)}
          onChange={(e) => {
            if (e.target.value) onSelect(new Date(e.target.value + 'T00:00:00'))
          }}
          className="absolute inset-0 opacity-0 w-full h-full pointer-events-none"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      {!isCurrentWeek && (
        <button
          onClick={() => onSelect(new Date())}
          aria-label="Kembali ke minggu ini"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 hover:border-primary/50 transition-all duration-150 cursor-pointer shrink-0"
        >
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
          </span>
          Minggu Ini
        </button>
      )}
    </div>
  )
}
