'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LeaderboardPodium } from './LeaderboardPodium'
import { LeaderboardTable } from './LeaderboardTable'
import { PodiumSkeleton, TableSkeleton } from './Skeletons'
import {
  MONTHS, CURRENT_MONTH, CURRENT_YEAR, YEARS,
  VISIT_STATUS_FILTER, TA_TYPES, PAKET_TYPES, SESI_TYPES,
  getMonthRange,
} from './utils'
import type { VisitForLeaderboard, StaffTargetRow, FisioStats } from './types'

const selectCls =
  'h-8 px-2.5 rounded-xl text-sm border border-border bg-card text-foreground ' +
  'focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors hover:border-primary/50'

interface TerapisTerbaikTabProps {
  branchFilter: string
}

export function TerapisTerbaikTab({ branchFilter }: TerapisTerbaikTabProps) {
  const [month, setMonth] = useState(CURRENT_MONTH)
  const [year, setYear]   = useState(CURRENT_YEAR)
  const [loading, setLoading] = useState(true)
  const [ranked, setRanked]   = useState<FisioStats[]>([])
  const [targets, setTargets] = useState<StaffTargetRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { start, end } = getMonthRange(month, year)

    const [visitsRes, targetsRes] = await Promise.all([
      (() => {
        let q = supabase
          .from('patient_visits')
          .select(
            'attending_staff_id, service_type, ' +
            'internal_profiles!attending_staff_id(full_name, avatar_url)',
          )
          .gte('visit_date', start)
          .lte('visit_date', end)
          .in('status', [...VISIT_STATUS_FILTER])
          .not('attending_staff_id', 'is', null)
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

    const vData = (visitsRes.data  ?? []) as unknown as VisitForLeaderboard[]
    const tData = (targetsRes.data ?? []) as unknown as StaffTargetRow[]
    setTargets(tData)

    // Aggregate by attending_staff_id
    const statsMap = new Map<string, FisioStats>()
    for (const v of vData) {
      const sid = v.attending_staff_id!
      const ip  = v.internal_profiles as any
      if (!statsMap.has(sid)) {
        statsMap.set(sid, {
          staff_id:   sid,
          name:       ip?.full_name ?? sid,
          avatar_url: ip?.avatar_url ?? null,
          ta: 0, paket: 0, sesi: 0, total: 0,
        })
      }
      const s = statsMap.get(sid)!
      s.total++
      const svcType = v.service_type ?? ''
      if ((TA_TYPES    as readonly string[]).includes(svcType)) s.ta++
      else if ((PAKET_TYPES as readonly string[]).includes(svcType)) s.paket++
      else if ((SESI_TYPES  as readonly string[]).includes(svcType)) s.sesi++
    }

    const sorted = Array.from(statsMap.values()).sort((a, b) => b.total - a.total)
    setRanked(sorted)
    setLoading(false)
  }, [month, year, branchFilter])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className={selectCls}>
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className={selectCls}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">
            {ranked.length} fisioterapis dengan kunjungan
          </span>
        </div>
      </div>

      {loading ? (
        <>
          <PodiumSkeleton />
          <TableSkeleton rows={8} />
        </>
      ) : (
        <>
          <LeaderboardPodium top3={ranked.slice(0, 3)} />
          <LeaderboardTable  data={ranked} targets={targets} />
        </>
      )}
    </div>
  )
}
