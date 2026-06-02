'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, BarChart2, Activity, Building2, Stethoscope } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 2022 }, (_, i) => CURRENT_YEAR - i)

type Tab = 'keuangan' | 'kunjungan' | 'cabang' | 'target'
type ChartType = 'bar' | 'line' | 'pie'

const PIE_COLORS = ['#FF0090', '#34C759', '#FF3B30', '#FFB35C', '#5E5CE6', '#30B0C7']

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function formatRpCompact(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

function trendIcon(pct: number | null) {
  if (pct === null) return <Minus size={14} className="text-muted-foreground" />
  if (pct > 0) return <TrendingUp size={14} className="text-chart-4" />
  if (pct < 0) return <TrendingDown size={14} className="text-destructive" />
  return <Minus size={14} className="text-muted-foreground" />
}

function trendColor(pct: number | null) {
  if (pct === null) return 'text-muted-foreground'
  if (pct > 0) return 'text-chart-4'
  if (pct < 0) return 'text-destructive'
  return 'text-muted-foreground'
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipPayload { value: number; name: string; color: string }
interface CustomTooltipProps { active?: boolean; payload?: TooltipPayload[]; label?: string; currency?: boolean }

function CustomTooltip({ active, payload, label, currency }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      backgroundColor: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '10px 14px',
      fontSize: 12,
      boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
    }}>
      <p style={{ color: 'var(--foreground)', fontWeight: 600, marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {currency ? formatRpCompact(p.value) : p.value.toLocaleString('id-ID')}
        </p>
      ))}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="glass-card p-5 animate-pulse">
      <div className="h-4 w-40 bg-muted rounded-lg mb-2" />
      <div className="h-3 w-60 bg-muted/60 rounded-lg mb-6" />
      <div className="flex items-end gap-3 h-80">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex-1 bg-muted rounded-t-lg" style={{ height: `${30 + (i * 7) % 70}%` }} />
        ))}
      </div>
    </div>
  )
}

function KPISkeleton() {
  return (
    <div className="glass-card p-5 animate-pulse">
      <div className="h-3 w-24 bg-muted rounded mb-3" />
      <div className="h-7 w-32 bg-muted rounded mb-2" />
      <div className="h-3 w-16 bg-muted/60 rounded" />
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthlyFinance { month: string; Pemasukan: number; Pengeluaran: number; 'Laba Bersih': number }
interface MonthlyVisit { month: string; Selesai: number; Terjadwal: number; Dibatalkan: number; 'Tidak Hadir': number }
interface BranchData { name: string; Pemasukan: number; Pengeluaran: number; 'Laba Bersih': number }
interface MonthlyTarget { month: string; Disetujui: number; Ditolak: number; Menunggu: number }

interface KPI {
  pemasukan: number
  pengeluaran: number
  profit: number
  kunjungan: number
  prevPemasukan: number | null
  prevPengeluaran: number | null
  prevProfit: number | null
  prevKunjungan: number | null
}

interface Branch { id: string; name: string }

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DirectorAnalyticsPage() {
  const [tab, setTab] = useState<Tab>('keuangan')
  const [year, setYear] = useState(CURRENT_YEAR)
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const [chartType, setChartType] = useState<ChartType>('bar')

  const [branches, setBranches] = useState<Branch[]>([])
  const [kpi, setKpi] = useState<KPI | null>(null)
  const [kpiLoading, setKpiLoading] = useState(true)

  const [financeData, setFinanceData] = useState<MonthlyFinance[]>([])
  const [visitData, setVisitData] = useState<MonthlyVisit[]>([])
  const [branchData, setBranchData] = useState<BranchData[]>([])
  const [targetData, setTargetData] = useState<MonthlyTarget[]>([])
  const [chartLoading, setChartLoading] = useState(true)

  // Load branches once
  useEffect(() => {
    async function loadBranches() {
      const { data } = await createClient().from('branches').select('id, name').eq('is_active', true).order('name')
      setBranches(data ?? [])
    }
    loadBranches()
  }, [])

  // KPI: reload on year + branch change
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

  // Chart data: reload on tab + year + branch change
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

  // Pie only makes sense for cabang
  const effectiveChartType: ChartType = (tab !== 'cabang' && chartType === 'pie') ? 'bar' : chartType

  function pct(cur: number, prev: number | null) {
    if (prev === null || prev === 0) return null
    return ((cur - prev) / prev) * 100
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'keuangan', label: 'Keuangan', icon: <TrendingUp size={15} /> },
    { id: 'kunjungan', label: 'Kunjungan', icon: <Stethoscope size={15} /> },
    { id: 'cabang', label: 'Per Cabang', icon: <Building2 size={15} /> },
    { id: 'target', label: 'Target', icon: <Activity size={15} /> },
  ]

  // ─── KPI Cards ──────────────────────────────────────────────────────────────

  const kpiCards = [
    {
      label: 'Total Pemasukan',
      value: kpi ? formatRp(kpi.pemasukan) : '—',
      pct: kpi ? pct(kpi.pemasukan, kpi.prevPemasukan) : null,
      color: 'var(--chart-4)',
    },
    {
      label: 'Total Pengeluaran',
      value: kpi ? formatRp(kpi.pengeluaran) : '—',
      pct: kpi ? pct(kpi.pengeluaran, kpi.prevPengeluaran) : null,
      color: 'var(--destructive)',
      invertTrend: true,
    },
    {
      label: 'Laba Bersih',
      value: kpi ? formatRp(kpi.profit) : '—',
      pct: kpi ? pct(kpi.profit, kpi.prevProfit) : null,
      color: 'var(--primary)',
    },
    {
      label: 'Total Kunjungan',
      value: kpi ? kpi.kunjungan.toLocaleString('id-ID') : '—',
      pct: kpi ? pct(kpi.kunjungan, kpi.prevKunjungan) : null,
      color: 'var(--secondary)',
    },
  ]

  // ─── Chart Rendering ────────────────────────────────────────────────────────

  function renderFinanceChart() {
    const data = financeData
    const title = 'Keuangan Bulanan'
    const sub = `Pemasukan, pengeluaran, dan laba bersih tahun ${year}`

    if (effectiveChartType === 'line') {
      return (
        <ChartCard title={title} sub={sub}>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="lgInc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-4)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatRpCompact} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={82} />
              <Tooltip content={<CustomTooltip currency />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Pemasukan" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Pengeluaran" stroke="var(--destructive)" strokeWidth={2} dot={false} strokeDasharray="5 3" />
              <Line type="monotone" dataKey="Laba Bersih" stroke="var(--primary)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )
    }

    return (
      <ChartCard title={title} sub={sub}>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barCategoryGap="30%">
            <defs>
              <linearGradient id="barInc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={1}/>
                <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0.6}/>
              </linearGradient>
              <linearGradient id="barExp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--destructive)" stopOpacity={1}/>
                <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.6}/>
              </linearGradient>
              <linearGradient id="barProf" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={1}/>
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.6}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatRpCompact} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={82} />
            <Tooltip content={<CustomTooltip currency />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Pemasukan" fill="url(#barInc)" radius={[5, 5, 0, 0]} />
            <Bar dataKey="Pengeluaran" fill="url(#barExp)" radius={[5, 5, 0, 0]} />
            <Bar dataKey="Laba Bersih" fill="url(#barProf)" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    )
  }

  function renderVisitChart() {
    const data = visitData
    const title = 'Kunjungan Bulanan'
    const sub = `Jumlah kunjungan pasien per bulan tahun ${year}`

    if (effectiveChartType === 'line') {
      return (
        <ChartCard title={title} sub={sub}>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Selesai" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Terjadwal" stroke="var(--secondary)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Dibatalkan" stroke="var(--destructive)" strokeWidth={2} dot={false} strokeDasharray="5 3" />
              <Line type="monotone" dataKey="Tidak Hadir" stroke="var(--muted-foreground)" strokeWidth={2} dot={false} strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )
    }

    return (
      <ChartCard title={title} sub={sub}>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barCategoryGap="28%">
            <defs>
              <linearGradient id="barSelesai" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={1}/>
                <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0.6}/>
              </linearGradient>
              <linearGradient id="barTerjadwal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--secondary)" stopOpacity={1}/>
                <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0.6}/>
              </linearGradient>
              <linearGradient id="barBatal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--destructive)" stopOpacity={1}/>
                <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.6}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={50} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Selesai" fill="url(#barSelesai)" radius={[5, 5, 0, 0]} />
            <Bar dataKey="Terjadwal" fill="url(#barTerjadwal)" radius={[5, 5, 0, 0]} />
            <Bar dataKey="Dibatalkan" fill="url(#barBatal)" radius={[5, 5, 0, 0]} />
            <Bar dataKey="Tidak Hadir" fill="var(--muted-foreground)" radius={[5, 5, 0, 0]} fillOpacity={0.5} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    )
  }

  function renderBranchChart() {
    const data = branchData
    const title = 'Perbandingan Per Cabang'
    const sub = `Keuangan tiap cabang tahun ${year}`

    if (chartType === 'pie') {
      const pieData = data.map(d => ({ name: d.name, value: d.Pemasukan }))
      return (
        <ChartCard title={title} sub={sub}>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={120} dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}>
                {pieData.map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: unknown) => formatRpCompact(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      )
    }

    if (chartType === 'line') {
      return (
        <ChartCard title={title} sub={sub}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barCategoryGap="30%">
              <defs>
                <linearGradient id="brInc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={1}/>
                  <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0.6}/>
                </linearGradient>
                <linearGradient id="brExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--destructive)" stopOpacity={1}/>
                  <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.6}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatRpCompact} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={82} />
              <Tooltip content={<CustomTooltip currency />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Pemasukan" fill="url(#brInc)" radius={[5, 5, 0, 0]} />
              <Bar dataKey="Pengeluaran" fill="url(#brExp)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )
    }

    return (
      <ChartCard title={title} sub={sub}>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barCategoryGap="30%">
            <defs>
              <linearGradient id="brInc2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={1}/>
                <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0.6}/>
              </linearGradient>
              <linearGradient id="brExp2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--destructive)" stopOpacity={1}/>
                <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.6}/>
              </linearGradient>
              <linearGradient id="brProf2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={1}/>
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.6}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatRpCompact} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={82} />
            <Tooltip content={<CustomTooltip currency />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Pemasukan" fill="url(#brInc2)" radius={[5, 5, 0, 0]} />
            <Bar dataKey="Pengeluaran" fill="url(#brExp2)" radius={[5, 5, 0, 0]} />
            <Bar dataKey="Laba Bersih" fill="url(#brProf2)" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    )
  }

  function renderTargetChart() {
    const data = targetData
    const title = 'Target Staff Bulanan'
    const sub = `Status target staff per bulan tahun ${year}`

    if (effectiveChartType === 'line') {
      return (
        <ChartCard title={title} sub={sub}>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={50} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Disetujui" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Menunggu" stroke="var(--secondary)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Ditolak" stroke="var(--destructive)" strokeWidth={2} dot={false} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )
    }

    return (
      <ChartCard title={title} sub={sub}>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barCategoryGap="30%">
            <defs>
              <linearGradient id="tApproved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={1}/>
                <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0.6}/>
              </linearGradient>
              <linearGradient id="tPending" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--secondary)" stopOpacity={1}/>
                <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0.6}/>
              </linearGradient>
              <linearGradient id="tRejected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--destructive)" stopOpacity={1}/>
                <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.6}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={50} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Disetujui" fill="url(#tApproved)" radius={[5, 5, 0, 0]} />
            <Bar dataKey="Menunggu" fill="url(#tPending)" radius={[5, 5, 0, 0]} />
            <Bar dataKey="Ditolak" fill="url(#tRejected)" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--primary)', opacity: 0.9 }}>
          <BarChart2 size={18} color="white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Statistik</h1>
          <p className="text-sm text-muted-foreground">Analitik lintas cabang untuk direktur</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiLoading
          ? Array.from({ length: 4 }).map((_, i) => <KPISkeleton key={i} />)
          : kpiCards.map((card) => {
              const p = card.pct
              const effectivePct = card.invertTrend && p !== null ? -p : p
              return (
                <div key={card.label} className="glass-card p-5">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{card.label}</p>
                  <p className="text-lg font-bold text-foreground leading-tight mb-2" style={{ color: card.color }}>{card.value}</p>
                  <div className="flex items-center gap-1">
                    {trendIcon(effectivePct)}
                    <span className={`text-xs font-medium ${trendColor(effectivePct)}`}>
                      {p !== null ? `${p > 0 ? '+' : ''}${p.toFixed(1)}% vs ${year - 1}` : `vs ${year - 1}`}
                    </span>
                  </div>
                </div>
              )
            })}
      </div>

      {/* Filter bar + Tabs */}
      <div className="glass-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div className="flex gap-1 flex-wrap">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
                  tab === t.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground/60 hover:text-foreground hover:bg-muted'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Branch */}
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className="h-8 px-2.5 rounded-xl text-sm border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Semua Cabang</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            {/* Year */}
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="h-8 px-2.5 rounded-xl text-sm border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Chart type toggle */}
            <div className="flex rounded-xl border border-border bg-card overflow-hidden">
              {(['bar', 'line', ...(tab === 'cabang' ? ['pie'] : [])] as ChartType[]).map((ct) => (
                <button
                  key={ct}
                  onClick={() => setChartType(ct)}
                  className={`h-8 px-3 text-xs font-medium transition-all capitalize ${
                    chartType === ct
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground/60 hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {ct === 'bar' ? 'Bar' : ct === 'line' ? 'Line' : 'Pie'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartLoading ? (
        <ChartSkeleton />
      ) : (
        <>
          {tab === 'keuangan' && renderFinanceChart()}
          {tab === 'kunjungan' && renderVisitChart()}
          {tab === 'cabang' && renderBranchChart()}
          {tab === 'target' && renderTargetChart()}
        </>
      )}
    </div>
  )
}

// ─── Chart Card ───────────────────────────────────────────────────────────────

function ChartCard({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
      {children}
    </div>
  )
}
