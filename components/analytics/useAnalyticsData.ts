'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MONTHS } from './constants'
import type { Branch, KPI, MonthlyFinance, MonthlyVisit, BranchData, MonthlyTarget, Tab } from './types'

// ─── useBranches ──────────────────────────────────────────────────────────────

export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([])

  useEffect(() => {
    async function loadBranches() {
      const { data } = await createClient().from('branches').select('id, name').eq('is_active', true).order('name')
      setBranches(data ?? [])
    }
    loadBranches()
  }, [])

  return { branches }
}

// ─── useKpi ───────────────────────────────────────────────────────────────────

export function useKpi(year: number, branchFilter: string) {
  const [kpi, setKpi] = useState<KPI | null>(null)
  const [kpiLoading, setKpiLoading] = useState(true)

  const loadKpi = useCallback(async () => {
    setKpiLoading(true)
    const supabase = createClient()

    let finQuery = supabase
      .from('branch_financial_reports')
      .select('total_income, total_expense, net_profit')
      .eq('period_year', year)
      .in('status', ['approved', 'submitted'])
    if (branchFilter !== 'all') finQuery = finQuery.eq('branch_id', branchFilter)
    const { data: finRows } = await finQuery

    let prevFinQuery = supabase
      .from('branch_financial_reports')
      .select('total_income, total_expense, net_profit')
      .eq('period_year', year - 1)
      .in('status', ['approved', 'submitted'])
    if (branchFilter !== 'all') prevFinQuery = prevFinQuery.eq('branch_id', branchFilter)
    const { data: prevFinRows } = await prevFinQuery

    let visQuery = supabase
      .from('patient_visits')
      .select('id', { count: 'exact', head: true })
      .gte('visit_date', `${year}-01-01`)
      .lte('visit_date', `${year}-12-31`)
    if (branchFilter !== 'all') visQuery = visQuery.eq('branch_id', branchFilter)
    const { count: visCount } = await visQuery

    let prevVisQuery = supabase
      .from('patient_visits')
      .select('id', { count: 'exact', head: true })
      .gte('visit_date', `${year - 1}-01-01`)
      .lte('visit_date', `${year - 1}-12-31`)
    if (branchFilter !== 'all') prevVisQuery = prevVisQuery.eq('branch_id', branchFilter)
    const { count: prevVisCount } = await prevVisQuery

    const sum = (rows: { total_income?: number; total_expense?: number; net_profit?: number }[] | null, key: 'total_income' | 'total_expense' | 'net_profit') =>
      (rows ?? []).reduce((s, r) => s + Number(r[key] ?? 0), 0)

    setKpi({
      pemasukan: sum(finRows, 'total_income'),
      pengeluaran: sum(finRows, 'total_expense'),
      profit: sum(finRows, 'net_profit'),
      kunjungan: visCount ?? 0,
      prevPemasukan: prevFinRows?.length ? sum(prevFinRows, 'total_income') : null,
      prevPengeluaran: prevFinRows?.length ? sum(prevFinRows, 'total_expense') : null,
      prevProfit: prevFinRows?.length ? sum(prevFinRows, 'net_profit') : null,
      prevKunjungan: prevVisCount ?? null,
    })
    setKpiLoading(false)
  }, [year, branchFilter])

  useEffect(() => { loadKpi() }, [loadKpi])

  return { kpi, kpiLoading }
}

// ─── useChartData ─────────────────────────────────────────────────────────────

export function useChartData(tab: Tab, year: number, branchFilter: string) {
  const [financeData, setFinanceData] = useState<MonthlyFinance[]>([])
  const [visitData, setVisitData] = useState<MonthlyVisit[]>([])
  const [branchData, setBranchData] = useState<BranchData[]>([])
  const [targetData, setTargetData] = useState<MonthlyTarget[]>([])
  const [chartLoading, setChartLoading] = useState(true)

  const loadChart = useCallback(async () => {
    setChartLoading(true)
    const supabase = createClient()

    if (tab === 'keuangan') {
      let q = supabase
        .from('branch_financial_reports')
        .select('period_month, total_income, total_expense, net_profit')
        .eq('period_year', year)
        .in('status', ['approved', 'submitted'])
      if (branchFilter !== 'all') q = q.eq('branch_id', branchFilter)
      const { data } = await q

      const monthly: Record<number, { inc: number; exp: number; prof: number }> = {}
      for (let m = 1; m <= 12; m++) monthly[m] = { inc: 0, exp: 0, prof: 0 }
      for (const r of data ?? []) {
        monthly[r.period_month].inc += Number(r.total_income ?? 0)
        monthly[r.period_month].exp += Number(r.total_expense ?? 0)
        monthly[r.period_month].prof += Number(r.net_profit ?? 0)
      }
      setFinanceData(Array.from({ length: 12 }, (_, i) => ({
        month: MONTHS[i],
        Pemasukan: monthly[i + 1].inc,
        Pengeluaran: monthly[i + 1].exp,
        'Laba Bersih': monthly[i + 1].prof,
      })))
    }

    if (tab === 'kunjungan') {
      let q = supabase
        .from('patient_visits')
        .select('visit_date, status')
        .gte('visit_date', `${year}-01-01`)
        .lte('visit_date', `${year}-12-31`)
      if (branchFilter !== 'all') q = q.eq('branch_id', branchFilter)
      const { data } = await q

      const monthly: Record<number, { completed: number; scheduled: number; cancelled: number; no_show: number }> = {}
      for (let m = 1; m <= 12; m++) monthly[m] = { completed: 0, scheduled: 0, cancelled: 0, no_show: 0 }
      for (const r of data ?? []) {
        const m = new Date(r.visit_date).getMonth() + 1
        if (r.status === 'completed') monthly[m].completed++
        else if (r.status === 'scheduled') monthly[m].scheduled++
        else if (r.status === 'cancelled') monthly[m].cancelled++
        else if (r.status === 'no_show') monthly[m].no_show++
      }
      setVisitData(Array.from({ length: 12 }, (_, i) => ({
        month: MONTHS[i],
        Selesai: monthly[i + 1].completed,
        Terjadwal: monthly[i + 1].scheduled,
        Dibatalkan: monthly[i + 1].cancelled,
        'Tidak Hadir': monthly[i + 1].no_show,
      })))
    }

    if (tab === 'cabang') {
      const { data } = await supabase
        .from('branch_financial_reports')
        .select('branch_id, total_income, total_expense, net_profit, branches(name)')
        .eq('period_year', year)
        .in('status', ['approved', 'submitted'])

      const byBranch: Record<string, { name: string; inc: number; exp: number; prof: number }> = {}
      for (const r of data ?? []) {
        const bname = (r.branches as unknown as { name: string } | null)?.name ?? r.branch_id
        if (!byBranch[r.branch_id]) byBranch[r.branch_id] = { name: bname, inc: 0, exp: 0, prof: 0 }
        byBranch[r.branch_id].inc += Number(r.total_income ?? 0)
        byBranch[r.branch_id].exp += Number(r.total_expense ?? 0)
        byBranch[r.branch_id].prof += Number(r.net_profit ?? 0)
      }
      setBranchData(Object.values(byBranch).map(b => ({
        name: b.name,
        Pemasukan: b.inc,
        Pengeluaran: b.exp,
        'Laba Bersih': b.prof,
      })))
    }

    if (tab === 'target') {
      let q = supabase
        .from('staff_targets')
        .select('bulan, status')
        .eq('tahun', year)
      if (branchFilter !== 'all') q = q.eq('branch_id', branchFilter)
      const { data } = await q

      const monthly: Record<number, { approved: number; rejected: number; pending: number }> = {}
      for (let m = 1; m <= 12; m++) monthly[m] = { approved: 0, rejected: 0, pending: 0 }
      for (const r of data ?? []) {
        if (r.status === 'approved') monthly[r.bulan].approved++
        else if (r.status === 'rejected') monthly[r.bulan].rejected++
        else monthly[r.bulan].pending++
      }
      setTargetData(Array.from({ length: 12 }, (_, i) => ({
        month: MONTHS[i],
        Disetujui: monthly[i + 1].approved,
        Ditolak: monthly[i + 1].rejected,
        Menunggu: monthly[i + 1].pending,
      })))
    }

    setChartLoading(false)
  }, [tab, year, branchFilter])

  useEffect(() => { loadChart() }, [loadChart])

  return { financeData, visitData, branchData, targetData, chartLoading }
}
