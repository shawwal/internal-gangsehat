'use client'

import { useState } from 'react'
import type { MyStudent } from '@/app/actions/griyaMyStudents'
import { StudentCard } from './StudentCard'
import { PAGE_SIZE } from './constants'
import type { PeriodStats } from './period'

export interface StudentRow { s: MyStudent; period: PeriodStats }

/** Remount with a new `key` to reset "show more" when filters change. */
export function StudentList({ rows, today, loading, emptyText, periodShortLabel, showTotal }: {
  rows: StudentRow[]; today: string; loading: boolean; emptyText: string
  periodShortLabel: string; showTotal: boolean
}) {
  const [shown, setShown] = useState(PAGE_SIZE)

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 animate-pulse">
        {[0, 1, 2].map((i) => <div key={i} className="h-56 rounded-3xl bg-muted" />)}
      </div>
    )
  }
  if (rows.length === 0) return <div className="glass-card p-8 text-center text-sm text-muted-foreground">{emptyText}</div>

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.slice(0, shown).map((r) => (
          <StudentCard key={r.s.patientId} s={r.s} period={r.period} today={today}
            periodLabel={periodShortLabel} showTotal={showTotal} />
        ))}
      </div>
      {rows.length > shown && (
        <button onClick={() => setShown((n) => n + PAGE_SIZE)}
          className="w-full py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
          Tampilkan lebih banyak ({rows.length - shown})
        </button>
      )}
    </>
  )
}
