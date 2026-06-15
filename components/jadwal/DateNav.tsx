'use client'

import { useRef } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, isSameDay, toIso, HARI_LABEL, JS_DAY_TO_HARI, getMondayOf } from './utils'

interface DateNavProps {
  selectedDate: Date
  today: Date
  onSelect: (d: Date) => void
}

export function DateNav({ selectedDate, today, onSelect }: DateNavProps) {
  const dateInputRef = useRef<HTMLInputElement>(null)
  const weekMonday   = getMondayOf(selectedDate)
  const dateChips    = [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(weekMonday, n))

  return (
    <div className="glass-card p-3 flex items-center gap-2">
      <button
        onClick={() => onSelect(addDays(weekMonday, -7))}
        aria-label="Minggu sebelumnya"
        className="p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {dateChips.map((d, i) => {
          const isSel   = isSameDay(d, selectedDate)
          const isTod   = isSameDay(d, today)
          const dayName = HARI_LABEL[JS_DAY_TO_HARI[d.getDay()]]
          return (
            <button
              key={i}
              onClick={() => onSelect(d)}
              className={[
                'flex flex-col items-center px-3 py-2 rounded-xl shrink-0 transition-all duration-150 cursor-pointer min-w-[52px]',
                isSel
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : isTod
                  ? 'border border-primary/50 text-primary hover:bg-primary/10'
                  : 'text-muted-foreground hover:bg-white/10 hover:text-foreground',
              ].join(' ')}
            >
              <span className="text-[10px] font-medium uppercase">{dayName?.slice(0, 3)}</span>
              <span className="text-lg font-bold leading-none">{d.getDate()}</span>
            </button>
          )
        })}
      </div>

      <button
        onClick={() => onSelect(addDays(weekMonday, 7))}
        aria-label="Minggu berikutnya"
        className="p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
      >
        <ChevronRight size={16} />
      </button>

      {/* Any-date picker */}
      <div className="relative shrink-0">
        <button
          onClick={() => dateInputRef.current?.showPicker()}
          title="Pilih tanggal"
          aria-label="Pilih tanggal"
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

      {!isSameDay(weekMonday, getMondayOf(today)) && (
        <button
          onClick={() => onSelect(getMondayOf(today))}
          className="px-3 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors cursor-pointer text-muted-foreground shrink-0"
        >
          Minggu Ini
        </button>
      )}
    </div>
  )
}
