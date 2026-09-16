'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchConfirmedVisitIds } from '@/lib/internal/paymentGating'
import { TargetKpiCard } from './TargetKpiCard'
import { FisioBarChart } from './FisioBarChart'
import { RecentVisitsTable } from './RecentVisitsTable'
import { KpiDetailModal, type KpiDetailRow } from './KpiDetailModal'
import { KpiSkeleton, ChartSkeleton, TableSkeleton } from './Skeletons'
import {
  MONTHS, CURRENT_MONTH, YEARS, VISIT_STATUS_FILTER, TODAY_ISO,
  TA_TYPES, PAKET_TYPES, classifyServiceType, isAttended, firstPackageVisits,
  getMonthRange, getWeekRangeInMonth, getMonthsInRange, addDaysISO, formatDateShort,
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
  const [customStart, setCustomStart] = useState(() => addDaysISO(TODAY_ISO, -30))
  const [customEnd, setCustomEnd]     = useState(TODAY_ISO)

  const [loading, setLoading]   = useState(true)
  const [visits, setVisits]     = useState<VisitRow[]>([])
  const [targets, setTargets]   = useState<StaffTargetRow[]>([])
  const [paidVisitIds, setPaidVisitIds] = useState<Set<string>>(new Set())
  const [openKpi, setOpenKpi] = useState<'ta' | 'paket' | 'kunjungan' | 'visit' | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const range =
      periodMode === 'bulan'
        ? getMonthRange(month, year)
        : periodMode === 'minggu'
          ? getWeekRangeInMonth(week, month, year)
          : { start: customStart, end: customEnd }

    // Parallel: visits + targets
    const [visitsRes, targetsRes] = await Promise.all([
      (() => {
        let q = supabase
          .from('patient_visits')
          .select(
            'id, patient_id, service_type, attending_staff_id, visit_date, kehadiran, package_id, ' +
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
          .eq('status', 'approved')
        if (periodMode === 'custom') {
          const months = getMonthsInRange(customStart, customEnd)
          q = q.or(months.map(({ bulan, tahun }) => `and(bulan.eq.${bulan},tahun.eq.${tahun})`).join(','))
        } else {
          q = q.eq('bulan', month).eq('tahun', year)
        }
        if (branchFilter !== 'all') q = q.eq('branch_id', branchFilter)
        return q
      })(),
    ])

    // patient_visits has no FK relationship registered for `patient_id` in the
    // PostgREST schema cache, so `patients!patient_id(...)` embedding silently
    // errors out the whole query — fetch patients separately instead (two-step).
    const rawVisits = (visitsRes.data ?? []) as unknown as (VisitRow & { patient_id: string })[]
    const patientIds = [...new Set(rawVisits.map(v => v.patient_id))]
    const { data: patientsData } = patientIds.length
      ? await supabase.from('patients').select('id, no_rm').in('id', patientIds)
      : { data: [] as { id: string; no_rm: string | null }[] }
    const noRmById = new Map((patientsData ?? []).map(p => [p.id, p.no_rm]))

    setVisits(rawVisits.map(v => ({ ...v, patients: { no_rm: noRmById.get(v.patient_id) ?? null } })))
    setTargets((targetsRes.data ?? []) as unknown as StaffTargetRow[])
    setPaidVisitIds(await fetchConfirmedVisitIds(supabase, rawVisits.map(v => v.id)))
    setLoading(false)
  }, [year, branchFilter, periodMode, month, week, customStart, customEnd])

  useEffect(() => { load() }, [load])

  // ── Derived KPI data ───────────────────────────────────────────────────────
  // Kehadiran ≠ Pembayaran: Kunjungan stays attendance-only, but TA/Paket/Visit
  // (which roll up into TA/SESI/PAKET progress) only count visits with a
  // confirmed payment behind them.
  const attended = visits.filter(v => isAttended(v, TODAY_ISO))
  const paidAttended = attended.filter(v => paidVisitIds.has(v.id))
  const paketAttended = paidAttended.filter(v => (PAKET_TYPES as readonly string[]).includes(v.service_type ?? ''))

  const taVisits      = paidAttended.filter(v => (TA_TYPES as readonly string[]).includes(v.service_type ?? ''))
  const paketVisits   = firstPackageVisits(paketAttended)
  const visitVisits   = firstPackageVisits(paketAttended.filter(v => v.service_type === 'PAKET VISIT'))

  const actualTA     = taVisits.length
  const actualPaket  = paketVisits.length
  const actualKunjungan = attended.length
  const actualVisit  = visitVisits.length

  const toKpiRow = (v: VisitRow): KpiDetailRow => ({
    id: v.id, patientId: v.patient_id, visitDate: v.visit_date, serviceType: v.service_type,
  })

  const targetTA         = targets.reduce((s, t) => s + (t.target_ta ?? 0), 0)
  const targetPaket      = targets.reduce((s, t) => s + (t.target_paket_klinik ?? 0), 0)
  const targetKunjungan  = targets.reduce((s, t) => s + (t.target_kunjungan ?? 0), 0)
  const targetVisit      = targets.reduce((s, t) => s + (t.target_visit ?? 0), 0)

  // ── Fisio bar data ─────────────────────────────────────────────────────────
  const fisioMap = new Map<string, { fullName: string; ta: number }>()
  for (const v of attended) {
    if (!v.attending_staff_id) continue
    const name = (v.internal_profiles as any)?.full_name ?? 'Unknown'
    const cur = fisioMap.get(v.attending_staff_id) ?? { fullName: name, ta: 0 }
    if ((TA_TYPES as readonly string[]).includes(v.service_type ?? '') && paidVisitIds.has(v.id)) {
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
      : periodMode === 'minggu'
        ? getWeekRangeInMonth(week, month, year).label
        : `${formatDateShort(customStart)} – ${formatDateShort(customEnd)}`

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Periode toggle */}
          <div className="flex rounded-xl border border-border bg-card overflow-hidden">
            {(['bulan', 'minggu', 'custom'] as PeriodMode[]).map(m => (
              <button
                key={m}
                onClick={() => setPeriodMode(m)}
                className={`h-8 px-4 text-xs font-medium transition-all capitalize cursor-pointer ${
                  periodMode === m
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground/60 hover:text-foreground hover:bg-muted'
                }`}
              >
                {m === 'bulan' ? 'Bulanan' : m === 'minggu' ? 'Mingguan' : 'Custom'}
              </button>
            ))}
          </div>

          {/* Month picker (bulan / minggu modes) */}
          {periodMode !== 'custom' && (
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className={selectCls}
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          )}

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

          {/* Custom date range (only in custom mode) */}
          {periodMode === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={e => setCustomStart(e.target.value)}
                className={selectCls}
              />
              <span className="text-xs text-muted-foreground">s/d</span>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                onChange={e => setCustomEnd(e.target.value)}
                className={selectCls}
              />
            </div>
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
          <TargetKpiCard label="Terapi Awal"       actual={actualTA}        target={targetTA}        color="var(--primary)"    delay={0}   onClick={() => setOpenKpi('ta')} />
          <TargetKpiCard label="Paket Masuk"       actual={actualPaket}     target={targetPaket}     color="var(--chart-4)"   delay={80}  onClick={() => setOpenKpi('paket')} />
          <TargetKpiCard label="Jumlah Kunjungan"  actual={actualKunjungan} target={targetKunjungan} color="var(--secondary)"  delay={160} onClick={() => setOpenKpi('kunjungan')} />
          <TargetKpiCard label="Paket Visit"       actual={actualVisit}     target={targetVisit}     color="var(--destructive)" delay={240} onClick={() => setOpenKpi('visit')} />
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

      <KpiDetailModal
        open={!!openKpi}
        onClose={() => setOpenKpi(null)}
        resetKey={openKpi ?? ''}
        title={
          openKpi === 'ta' ? 'Terapi Awal' :
          openKpi === 'paket' ? 'Paket Masuk' :
          openKpi === 'visit' ? 'Paket Visit' : 'Jumlah Kunjungan'
        }
        periodLabel={periodLabel}
        rows={
          openKpi === 'ta' ? taVisits.map(toKpiRow) :
          openKpi === 'paket' ? paketVisits.map(toKpiRow) :
          openKpi === 'visit' ? visitVisits.map(toKpiRow) :
          openKpi === 'kunjungan' ? attended.map(toKpiRow) : []
        }
      />
    </div>
  )
}
