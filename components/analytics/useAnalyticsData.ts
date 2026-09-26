'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MONTHS } from './constants'
import type { Branch, KPI, MonthlyFinance, MonthlyVisit, BranchData, MonthlyTarget, Tab } from './types'

// ─── helpers ──────────────────────────────────────────────────────────────────

type Supabase = ReturnType<typeof createClient>
type TxRow = { branch_id: string; type: string; harga: number | null; discount: number | null; amount: number | null; transaction_date: string; branches?: unknown }

// PostgREST caps responses (default 1000 rows) — page through everything.
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const PAGE = 1000
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data } = await build(from, from + PAGE - 1)
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return out
}

// Same basis as the Keuangan page: income = harga − discount, expense = amount, rejected excluded.
function fetchTransactions(supabase: Supabase, year: number, branchFilter: string, select = 'branch_id, type, harga, discount, amount, transaction_date') {
  return fetchAll<TxRow>((from, to) => {
    let q = supabase
      .from('transactions')
      .select(select)
      .neq('status', 'rejected')
      .gte('transaction_date', `${year}-01-01`)
      .lt('transaction_date', `${year + 1}-01-01`)
      .order('id')
      .range(from, to)
    if (branchFilter !== 'all') q = q.eq('branch_id', branchFilter)
    return q as unknown as PromiseLike<{ data: TxRow[] | null }>
  })
}

const txIncome  = (t: TxRow) => t.type === 'income'  ? Number(t.harga ?? 0) - Number(t.discount ?? 0) : 0
const txExpense = (t: TxRow) => t.type === 'expense' ? Number(t.amount ?? 0) : 0

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

    const [finRows, prevFinRows] = await Promise.all([
      fetchTransactions(supabase, year, branchFilter),
      fetchTransactions(supabase, year - 1, branchFilter),
    ])

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

    const inc = (rows: TxRow[]) => rows.reduce((s, r) => s + txIncome(r), 0)
    const exp = (rows: TxRow[]) => rows.reduce((s, r) => s + txExpense(r), 0)
    const hasPrev = prevFinRows.length > 0

    setKpi({
      pemasukan: inc(finRows),
      pengeluaran: exp(finRows),
      profit: inc(finRows) - exp(finRows),
      kunjungan: visCount ?? 0,
      prevPemasukan: hasPrev ? inc(prevFinRows) : null,
      prevPengeluaran: hasPrev ? exp(prevFinRows) : null,
      prevProfit: hasPrev ? inc(prevFinRows) - exp(prevFinRows) : null,
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
      const data = await fetchTransactions(supabase, year, branchFilter)

      const monthly: Record<number, { inc: number; exp: number; prof: number }> = {}
      for (let m = 1; m <= 12; m++) monthly[m] = { inc: 0, exp: 0, prof: 0 }
      for (const r of data) {
        const m = Number(r.transaction_date.slice(5, 7))
        monthly[m].inc += txIncome(r)
        monthly[m].exp += txExpense(r)
        monthly[m].prof += txIncome(r) - txExpense(r)
      }
      setFinanceData(Array.from({ length: 12 }, (_, i) => ({
        month: MONTHS[i],
        Pemasukan: monthly[i + 1].inc,
        Pengeluaran: monthly[i + 1].exp,
        'Laba Bersih': monthly[i + 1].prof,
      })))
    }

    if (tab === 'kunjungan') {
      const data = await fetchAll<{ visit_date: string; status: string }>((from, to) => {
        let q = supabase
          .from('patient_visits')
          .select('visit_date, status')
          .gte('visit_date', `${year}-01-01`)
          .lte('visit_date', `${year}-12-31`)
          .order('id')
          .range(from, to)
        if (branchFilter !== 'all') q = q.eq('branch_id', branchFilter)
        return q
      })

      const monthly: Record<number, { completed: number; scheduled: number; cancelled: number; no_show: number }> = {}
      for (let m = 1; m <= 12; m++) monthly[m] = { completed: 0, scheduled: 0, cancelled: 0, no_show: 0 }
      for (const r of data ?? []) {
        const m = Number(r.visit_date.slice(5, 7))
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
      const data = await fetchTransactions(supabase, year, branchFilter, 'branch_id, type, harga, discount, amount, transaction_date, branches!branch_id(name)')

      const byBranch: Record<string, { name: string; inc: number; exp: number; prof: number }> = {}
      for (const r of data) {
        const bname = (r.branches as { name: string } | null)?.name ?? r.branch_id
        if (!byBranch[r.branch_id]) byBranch[r.branch_id] = { name: bname, inc: 0, exp: 0, prof: 0 }
        byBranch[r.branch_id].inc += txIncome(r)
        byBranch[r.branch_id].exp += txExpense(r)
        byBranch[r.branch_id].prof += txIncome(r) - txExpense(r)
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
