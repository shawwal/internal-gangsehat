'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TargetKpiCard } from './TargetKpiCard'
import { FisioBarChart } from './FisioBarChart'
import { RecentVisitsTable } from './RecentVisitsTable'
import { KpiSkeleton, ChartSkeleton, TableSkeleton } from './Skeletons'
import {
  MONTHS, CURRENT_MONTH, YEARS, VISIT_STATUS_FILTER,
  TA_TYPES, PAKET_TYPES, classifyServiceType,
  getMonthRange, getWeekRangeInMonth,
} from './utils'
import type {
  StaffTargetRow, VisitRow, FisioBarData, PeriodMode,
} from './types'

const selectCls =
  'h-8 px-2.5 rounded-xl text-sm border border-border bg-card text-foreground ' +
  'focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors hover:border-primary/50'

interface KontrolTargetTabProps {
  year: number
  branchFilter: string
}

export function KontrolTargetTab({ year, branchFilter }: KontrolTargetTabProps) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('bulan')
  const [month, setMonth]         = useState(CURRENT_MONTH)
  const [week, setWeek]           = useState<1 | 2 | 3 | 4>(1)

  const [loading, setLoading]   = useState(true)
  const [visits, setVisits]     = useState<VisitRow[]>([])
  const [targets, setTargets]   = useState<StaffTargetRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const range =
      periodMode === 'bulan'
        ? getMonthRange(month, year)
        : getWeekRangeInMonth(week, month, year)

    // Parallel: visits + targets
    const [visitsRes, targetsRes] = await Promise.all([
      (() => {
        let q = supabase
          .from('patient_visits')
          .select(
            'id, service_type, attending_staff_id, visit_date, ' +
            'patients!patient_id(no_rm), ' +
            'internal_profiles!attending_staff_id(full_name)',
          )
          .gte('visit_date', range.start)
          .lte('visit_date', range.end)
          .in('status', [...VISIT_STATUS_FILTER])
          .order('visit_date', { ascending: false })
        if (branchFilter !== 'all') q = q.eq('branch_id', branchFilter)
        return q
      })(),
      (() => {
        let q = supabase
          .from('staff_targets')
          .select(
            'staff_id, target_ta, target_paket_klinik, target_kunjungan, target_visit, ' +
            'internal_profiles!staff_id(full_name)',
          )
          .eq('bulan', month)
          .eq('tahun', year)
          .eq('status', 'approved')
        if (branchFilter !== 'all') q = q.eq('branch_id', branchFilter)
        return q
      })(),
    ])

    setVisits((visitsRes.data ?? []) as unknown as VisitRow[])
    setTargets((targetsRes.data ?? []) as unknown as StaffTargetRow[])
    setLoading(false)
  }, [year, branchFilter, periodMode, month, week])

  useEffect(() => { load() }, [load])

  // ── Derived KPI data ───────────────────────────────────────────────────────
  const actualTA     = visits.filter(v => (TA_TYPES as readonly string[]).includes(v.service_type ?? '')).length
  const actualPaket  = visits.filter(v => (PAKET_TYPES as readonly string[]).includes(v.service_type ?? '')).length
  const actualKunjungan = visits.length
  const actualVisit  = visits.filter(v => v.service_type === 'PAKET VISIT').length

  const targetTA         = targets.reduce((s, t) => s + (t.target_ta ?? 0), 0)
  const targetPaket      = targets.reduce((s, t) => s + (t.target_paket_klinik ?? 0), 0)
  const targetKunjungan  = targets.reduce((s, t) => s + (t.target_kunjungan ?? 0), 0)
  const targetVisit      = targets.reduce((s, t) => s + (t.target_visit ?? 0), 0)

  // ── Fisio bar data ─────────────────────────────────────────────────────────
  const fisioMap = new Map<string, { fullName: string; ta: number }>()
  for (const v of visits) {
    if (!v.attending_staff_id) continue
    const name = (v.internal_profiles as any)?.full_name ?? 'Unknown'
    const cur = fisioMap.get(v.attending_staff_id) ?? { fullName: name, ta: 0 }
    if ((TA_TYPES as readonly string[]).includes(v.service_type ?? '')) {
      fisioMap.set(v.attending_staff_id, { ...cur, ta: cur.ta + 1 })
    } else if (!fisioMap.has(v.attending_staff_id)) {
      fisioMap.set(v.attending_staff_id, cur)
    }
  }
  const barData: FisioBarData[] = Array.from(fisioMap.entries())
    .map(([, v]) => ({ name: v.fullName, fullName: v.fullName, ta: v.ta }))
    .sort((a, b) => b.ta - a.ta)

  const avgTarget = targets.length ? Math.round(targetTA / targets.length) : 0

  // ── Period label ───────────────────────────────────────────────────────────
  const periodLabel =
    periodMode === 'bulan'
      ? `${MONTHS[month - 1]} ${year}`
      : getWeekRangeInMonth(week, month, year).label

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Periode toggle */}
          <div className="flex rounded-xl border border-border bg-card overflow-hidden">
            {(['bulan', 'minggu'] as PeriodMode[]).map(m => (
              <button
                key={m}
                onClick={() => setPeriodMode(m)}
                className={`h-8 px-4 text-xs font-medium transition-all capitalize cursor-pointer ${
                  periodMode === m
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground/60 hover:text-foreground hover:bg-muted'
                }`}
              >
                {m === 'bulan' ? 'Bulanan' : 'Mingguan'}
              </button>
            ))}
          </div>

          {/* Month picker */}
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className={selectCls}
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>

          {/* Week picker (only in minggu mode) */}
          {periodMode === 'minggu' && (
            <select
              value={week}
              onChange={e => setWeek(Number(e.target.value) as 1 | 2 | 3 | 4)}
              className={selectCls}
            >
              {([1, 2, 3, 4] as const).map(w => (
                <option key={w} value={w}>
                  {getWeekRangeInMonth(w, month, year).label}
                </option>
              ))}
            </select>
          )}

          <span className="text-xs text-muted-foreground ml-auto hidden sm:block">
            {periodLabel}
          </span>
        </div>
      </div>

      {/* KPI cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <TargetKpiCard label="Terapi Awal"       actual={actualTA}        target={targetTA}        color="var(--primary)"    delay={0} />
          <TargetKpiCard label="Paket Masuk"       actual={actualPaket}     target={targetPaket}     color="var(--chart-4)"   delay={80} />
          <TargetKpiCard label="Jumlah Kunjungan"  actual={actualKunjungan} target={targetKunjungan} color="var(--secondary)"  delay={160} />
          <TargetKpiCard label="Paket Visit"       actual={actualVisit}     target={targetVisit}     color="var(--destructive)" delay={240} />
        </div>
      )}

      {/* Bar chart */}
      {loading ? <ChartSkeleton /> : (
        <FisioBarChart data={barData} avgTarget={avgTarget} />
      )}

      {/* Visits table */}
      {loading ? <TableSkeleton /> : (
        <RecentVisitsTable visits={visits} />
      )}
    </div>
  )
}
