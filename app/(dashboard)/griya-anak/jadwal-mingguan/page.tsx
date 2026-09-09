'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useGriyaJadwal } from '@/hooks/useGriyaJadwal'
import { DateNav } from '@/components/jadwal/DateNav'
import { getMondayOf } from '@/components/jadwal/utils'
import { GridSkeleton } from '@/components/griya/GridSkeleton'
import { Legend } from '@/components/griya/Legend'
import { WeekGrid } from '@/components/griya/WeekGrid'
import { DISCIPLINE_LABEL, DISCIPLINES } from '@/components/griya/constants'
import type { Discipline } from '@/app/actions/griyaJadwal'

export default function GriyaJadwalMingguanPage() {
  const { today, selectedDate, setSelectedDate, week, loading, enabled, branchId, reload } = useGriyaJadwal()
  const [discipline, setDiscipline] = useState<Discipline | 'ALL'>('ALL')

  const weekMonday = getMondayOf(selectedDate)
  const weekEnd = new Date(weekMonday)
  weekEnd.setDate(weekEnd.getDate() + 6)

  if (branchId === null && enabled === false) {
    return <div className="glass-card p-8 text-sm text-muted-foreground">Fitur Jadwal Griya Anak belum aktif untuk cabang ini.</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Jadwal Mingguan Griya Anak</h1>
          <p className="text-sm text-muted-foreground">
            {weekMonday.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} –{' '}
            {weekEnd.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value as Discipline | 'ALL')}
            className="px-3 py-2 rounded-xl border border-border text-sm bg-background cursor-pointer"
          >
            <option value="ALL">Semua disiplin</option>
            {DISCIPLINES.map((d) => (
              <option key={d} value={d}>{DISCIPLINE_LABEL[d]}</option>
            ))}
          </select>
          <button
            onClick={() => reload()}
            className="p-2 rounded-xl border border-border hover:bg-muted cursor-pointer text-muted-foreground"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <DateNav selectedDate={selectedDate} today={today} onSelect={setSelectedDate} />

      {loading ? (
        <GridSkeleton />
      ) : (
        <WeekGrid week={week} weekMonday={weekMonday} today={today} disciplineFilter={discipline} />
      )}

      <Legend />
    </div>
  )
}
