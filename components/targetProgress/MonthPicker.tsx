'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MONTHS } from './utils'

interface MonthPickerProps {
  month: number // 1-12
  year: number
  onChange: (month: number, year: number) => void
}

export function MonthPicker({ month, year, onChange }: MonthPickerProps) {
  function prev() {
    if (month === 1) onChange(12, year - 1)
    else onChange(month - 1, year)
  }
  function next() {
    if (month === 12) onChange(1, year + 1)
    else onChange(month + 1, year)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={prev}
        className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer"
        aria-label="Bulan sebelumnya"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm font-medium text-foreground w-28 text-center">
        {MONTHS[month - 1]} {year}
      </span>
      <button
        onClick={next}
        className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer"
        aria-label="Bulan berikutnya"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
