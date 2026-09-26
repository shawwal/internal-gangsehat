'use client'

import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useGriyaBranch } from '@/hooks/useGriyaBranch'
import type { MyStudent } from '@/app/actions/griyaMyStudents'
import { useMyStudents } from '@/components/griya/siswa-saya/useMyStudents'
import { PeriodFilter } from '@/components/griya/siswa-saya/PeriodFilter'
import { StudentStats } from '@/components/griya/siswa-saya/StudentStats'
import { StudentFilters, DEFAULT_FILTERS, type StudentFilterState } from '@/components/griya/siswa-saya/StudentFilters'
import { StudentList, type StudentRow } from '@/components/griya/siswa-saya/StudentList'
import { periodShort, resolveBounds, statsInPeriod, type Period } from '@/components/griya/siswa-saya/period'

export default function GriyaMySiswaPage() {
  const { loading: gateLoading, branchId, enabled } = useGriyaBranch()
  const { students, today, loading, error, reload } = useMyStudents(!!branchId && enabled)

  const [period, setPeriod] = useState<Period>({ mode: 'month', from: '', to: '' })
  const [filters, setFilters] = useState<StudentFilterState>(DEFAULT_FILTERS)
  const patchFilters = (p: Partial<StudentFilterState>) => setFilters((f) => ({ ...f, ...p }))

  const bounds = useMemo(() => resolveBounds(period, today), [period, today])

  // Per-student counts for the selected period; outside "all time" we only keep
  // children who had at least one (attended or missed) session in it.
  const inPeriod = useMemo<StudentRow[]>(() => students
    .map((s) => ({ s, period: statsInPeriod(s, bounds) }))
    .filter((r) => !bounds || r.period.touched), [students, bounds])

  const stats = useMemo(() => ({
    active: students.filter((s) => s.status === 'active').length,
    total: students.length,
    inPeriod: inPeriod.length,
    sessions: inPeriod.reduce((n, r) => n + r.period.sessions, 0),
    missed: inPeriod.reduce((n, r) => n + r.period.missed, 0),
    pending: students.reduce((n, s) => n + s.pendingRecords, 0),
    scheduled: students.filter((s) => s.nextVisit).length,
  }), [students, inPeriod])

  const rows = useMemo(() => {
    const { search, status, onlyPending, sort } = filters
    const q = search.trim().toLowerCase()
    const list = inPeriod.filter(({ s }) =>
      (status === 'all' || s.status === status) &&
      (!onlyPending || s.pendingRecords > 0) &&
      (!q || s.name.toLowerCase().includes(q) || (s.keluhan ?? '').toLowerCase().includes(q)),
    )
    const byName = (a: MyStudent, b: MyStudent) => a.name.localeCompare(b.name, 'id')
    return list.sort(({ s: a, period: pa }, { s: b, period: pb }) => {
      if (sort === 'last') return (b.lastVisit ?? '').localeCompare(a.lastVisit ?? '') || byName(a, b)
      if (sort === 'sessions') return pb.sessions - pa.sessions || byName(a, b)
      if (sort === 'next') {
        if (!a.nextVisit && !b.nextVisit) return byName(a, b)
        if (!a.nextVisit) return 1
        if (!b.nextVisit) return -1
        return a.nextVisit.localeCompare(b.nextVisit) || byName(a, b)
      }
      return byName(a, b)
    })
  }, [inPeriod, filters])

  const hasFilter = filters.search !== '' || filters.status !== DEFAULT_FILTERS.status || filters.onlyPending
  const resetFilters = () => setFilters((f) => ({ ...DEFAULT_FILTERS, sort: f.sort }))

  if (gateLoading) return <div className="text-sm text-muted-foreground">Memuat...</div>
  if (!branchId || !enabled) return <div className="glass-card p-8 text-sm text-muted-foreground">Fitur Griya Anak belum aktif untuk cabang ini.</div>

  const emptyText = students.length === 0
    ? 'Belum ada siswa yang Anda tangani.'
    : inPeriod.length === 0
      ? 'Tidak ada sesi pada periode ini. Coba pilih rentang lain atau "Semua waktu".'
      : 'Tidak ada siswa yang cocok dengan filter.'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Siswa Saya</h1>
          <p className="text-sm text-muted-foreground">Anak-anak yang pernah Anda tangani</p>
        </div>
        <button onClick={reload} disabled={loading} aria-label="Muat ulang"
          className="p-2 rounded-xl border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 cursor-pointer">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <PeriodFilter value={period} onChange={setPeriod} today={today} />

      <StudentStats data={stats} periodAll={period.mode === 'all'}
        onPendingClick={() => patchFilters({ onlyPending: true, status: 'all' })} />

      <StudentFilters value={filters} onChange={patchFilters} />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{loading ? 'Memuat...' : `${rows.length} siswa`}</span>
        {hasFilter && <button onClick={resetFilters} className="text-primary hover:underline cursor-pointer">Reset filter</button>}
      </div>

      {error && <div className="glass-card p-4 text-sm text-destructive">{error}</div>}

      <StudentList key={JSON.stringify([filters, period])} rows={rows} today={today} loading={loading} emptyText={emptyText}
        periodShortLabel={periodShort(period.mode)} showTotal={period.mode !== 'all'} />
    </div>
  )
}
