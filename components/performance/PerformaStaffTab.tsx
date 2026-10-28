'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetchAll'
import { FisioSelector } from './FisioSelector'
import { ServiceDonutChart } from './ServiceDonutChart'
import { MonthlyTrendChart } from './MonthlyTrendChart'
import { ServiceMiniChart } from './ServiceMiniChart'
import { ChartSkeleton } from './Skeletons'
import {
  MONTHS, VISIT_STATUS_FILTER, TODAY_ISO, TA_TYPES, PAKET_TYPES, SESI_TYPES,
  classifyServiceType, isAttended,
} from './utils'
import type { VisitForPerforma, MonthlyData, FisioInfo, ViewMode } from './types'

interface PerformaStaffTabProps {
  year: number
  branchFilter: string
}

export function PerformaStaffTab({ year, branchFilter }: PerformaStaffTabProps) {
  const [viewMode, setViewMode]         = useState<ViewMode>('tim')
  const [selectedFisioId, setFisioId]   = useState<string | null>(null)
  const [loading, setLoading]           = useState(true)
  const [visits, setVisits]             = useState<VisitForPerforma[]>([])
  const [prevVisits, setPrevVisits]     = useState<VisitForPerforma[]>([])
  const [fisioList, setFisioList]       = useState<FisioInfo[]>([])

  const reqId = useRef(0)

  const load = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    const supabase = createClient()

    // A full year across branches is well past PostgREST's 1000-row cap — page it.
    const fetchYear = (y: number) => fetchAllRows<VisitForPerforma>((from, to) => {
      let q = supabase
        .from('patient_visits')
        .select('visit_date, service_type, attending_staff_id, kehadiran')
        .gte('visit_date', `${y}-01-01`)
        .lte('visit_date', `${y}-12-31`)
        .in('status', [...VISIT_STATUS_FILTER])
        .order('id')
        .range(from, to)
      if (branchFilter !== 'all') q = q.eq('branch_id', branchFilter)
      if (viewMode === 'individual' && selectedFisioId)
        q = q.eq('attending_staff_id', selectedFisioId)
      return q as unknown as PromiseLike<{ data: VisitForPerforma[] | null; error: unknown }>
    })

    try {
      const [curRows, prevRows] = await Promise.all([fetchYear(year), fetchYear(year - 1)])
      if (id !== reqId.current) return

      const curData  = curRows.filter(v => isAttended(v, TODAY_ISO))
      const prevData = prevRows.filter(v => isAttended(v, TODAY_ISO))
      setVisits(curData)
      setPrevVisits(prevData)

      // Build fisio list from distinct attending_staff_id across current year (all visits)
      const idSet = new Set<string>()
      const nameMap = new Map<string, string>()

      if (fisioList.length === 0) {
        type StaffVisit = { attending_staff_id: string; visit_date: string; kehadiran: VisitForPerforma['kehadiran']; internal_profiles: unknown }
        const allVisits = await fetchAllRows<StaffVisit>((from, to) => {
          let allQ = supabase
            .from('patient_visits')
            .select('attending_staff_id, visit_date, kehadiran, internal_profiles!attending_staff_id(full_name)')
            .gte('visit_date', `${year}-01-01`)
            .lte('visit_date', `${year}-12-31`)
            .not('attending_staff_id', 'is', null)
            .in('status', [...VISIT_STATUS_FILTER])
            .order('id')
            .range(from, to)
          if (branchFilter !== 'all') allQ = allQ.eq('branch_id', branchFilter)
          return allQ as unknown as PromiseLike<{ data: StaffVisit[] | null; error: unknown }>
        })
        if (id !== reqId.current) return
        for (const v of allVisits.filter(v => isAttended(v, TODAY_ISO))) {
          const sid = v.attending_staff_id
          if (!idSet.has(sid)) {
            idSet.add(sid)
            nameMap.set(sid, (v.internal_profiles as any)?.full_name ?? sid)
          }
        }
        setFisioList(
          Array.from(idSet).map(id => ({ id, name: nameMap.get(id) ?? id })),
        )
      }

    } catch (err) {
      console.error('[PerformaStaffTab] load failed', err)
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [year, branchFilter, viewMode, selectedFisioId])

  useEffect(() => { load() }, [load])
  // Reset fisio list when year/branch changes
  useEffect(() => { setFisioList([]) }, [year, branchFilter])

  // ── Derived totals ─────────────────────────────────────────────────────────
  const totalCur  = visits.length
  const totalPrev = prevVisits.length
  const trendPct  = totalPrev > 0 ? ((totalCur - totalPrev) / totalPrev) * 100 : null

  const taCur    = visits.filter(v => (TA_TYPES    as readonly string[]).includes(v.service_type ?? '')).length
  const paketCur = visits.filter(v => (PAKET_TYPES as readonly string[]).includes(v.service_type ?? '')).length
  const sesiCur  = visits.filter(v => (SESI_TYPES  as readonly string[]).includes(v.service_type ?? '')).length

  // ── Monthly breakdown ──────────────────────────────────────────────────────
  const monthly: MonthlyData[] = MONTHS.map((m, idx) => {
    const mo = idx + 1
    const inMonth = visits.filter(v => new Date(v.visit_date).getMonth() + 1 === mo)
    return {
      month: m,
      ta:    inMonth.filter(v => (TA_TYPES    as readonly string[]).includes(v.service_type ?? '')).length,
      paket: inMonth.filter(v => (PAKET_TYPES as readonly string[]).includes(v.service_type ?? '')).length,
      sesi:  inMonth.filter(v => (SESI_TYPES  as readonly string[]).includes(v.service_type ?? '')).length,
      total: inMonth.length,
    }
  })

  const taMini    = monthly.map(d => ({ month: d.month, value: d.ta }))
  const paketMini = monthly.map(d => ({ month: d.month, value: d.paket }))
  const sesiMini  = monthly.map(d => ({ month: d.month, value: d.sesi }))

  const TrendIcon = trendPct === null
    ? Minus
    : trendPct > 0 ? TrendingUp : TrendingDown

  const trendColor = trendPct === null
    ? 'var(--muted-foreground)'
    : trendPct > 0 ? 'var(--chart-4)' : 'var(--destructive)'

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-border bg-card overflow-hidden">
            {(['tim', 'individual'] as ViewMode[]).map(m => (
              <button
                key={m}
                onClick={() => { setViewMode(m); if (m === 'tim') setFisioId(null) }}
                className={`h-8 px-4 text-xs font-medium transition-all capitalize cursor-pointer ${
                  viewMode === m
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground/60 hover:text-foreground hover:bg-muted'
                }`}
              >
                {m === 'tim' ? 'Tim' : 'Individual'}
              </button>
            ))}
          </div>
          {viewMode === 'individual' && (
            <FisioSelector
              fisioList={fisioList}
              value={selectedFisioId}
              onChange={setFisioId}
            />
          )}
        </div>
      </div>

      {loading ? (
        <>
          <ChartSkeleton height={100} />
          <div className="grid md:grid-cols-2 gap-5">
            <ChartSkeleton height={220} />
            <ChartSkeleton height={260} />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[1,2,3].map(i => <ChartSkeleton key={i} height={140} />)}
          </div>
        </>
      ) : (
        <>
          {/* Total Layanan KPI */}
          <div
            className="glass-card p-5 animate-fade-in-up"
            style={{ '--stagger-delay': '0ms' } as React.CSSProperties}
          >
            <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
              Total Layanan {year}
            </p>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold" style={{ color: 'var(--primary)' }}>
                {totalCur.toLocaleString('id-ID')}
              </span>
              {trendPct !== null && (
                <span className="flex items-center gap-1 text-sm font-medium" style={{ color: trendColor }}>
                  <TrendIcon size={14} />
                  {trendPct > 0 ? '+' : ''}{trendPct.toFixed(1)}% vs {year - 1}
                </span>
              )}
            </div>
          </div>

          {/* Donut + Trend */}
          <div className="grid md:grid-cols-2 gap-5">
            <ServiceDonutChart ta={taCur} paket={paketCur} sesi={sesiCur} />
            <MonthlyTrendChart data={monthly} year={year} />
          </div>

          {/* Mini charts */}
          <div
            className="grid md:grid-cols-3 gap-4"
            style={{ '--stagger-delay': '100ms' } as React.CSSProperties}
          >
            <ServiceMiniChart
              title="Terapi Awal"
              subtitle="Terapi Awal Klinik + Terapi Awal Visit"
              data={taMini}
              color="var(--primary)"
              gradientId="perf-ta-mini"
            />
            <ServiceMiniChart
              title="Paket"
              subtitle="Paket Klinik + Paket Visit"
              data={paketMini}
              color="var(--chart-4)"
              gradientId="perf-paket-mini"
            />
            <ServiceMiniChart
              title="Sesi"
              subtitle="Sesi Klinik + Sesi Visit"
              data={sesiMini}
              color="var(--secondary)"
              gradientId="perf-sesi-mini"
            />
          </div>
        </>
      )}
    </div>
  )
}
