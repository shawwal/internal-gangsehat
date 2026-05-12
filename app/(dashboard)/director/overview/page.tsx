import { createClient } from '@/lib/supabase/server'
import { Users, TrendingUp, TrendingDown, DollarSign, Building2 } from 'lucide-react'
import Link from 'next/link'
import { ChartsSection } from '@/components/dashboard/charts/ChartsSection'
import type { BranchRevenueData } from '@/components/dashboard/charts/BranchRevenueChart'
import type { MonthlyTrendData } from '@/components/dashboard/charts/MonthlyTrendChart'

export const dynamic = 'force-dynamic'

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n)
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  color: string
  sub?: string
}

function GlassStatCard({ title, value, icon, color, sub }: StatCardProps) {
  return (
    <div className="glass-card p-5 hover:scale-[1.02] transition-transform duration-200 cursor-default">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

export default async function DirectorOverviewPage() {
  const supabase = await createClient()

  const [
    { count: totalPatients },
    { count: totalStaff },
    { count: activeBranches },
    { data: incomeData },
    { data: expenseData },
    { data: branchReports },
    { data: monthlyTrend },
    { data: pendingReports },
  ] = await Promise.all([
    supabase.from('patients').select('id', { count: 'exact', head: true }),
    supabase.from('internal_profiles').select('id', { count: 'exact', head: true }).eq('is_active', true).neq('role', 'staff'),
    supabase.from('branches').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('transactions').select('amount').eq('type', 'income').eq('status', 'confirmed'),
    supabase.from('transactions').select('amount').eq('type', 'expense').eq('status', 'confirmed'),
    // Branch revenue chart data
    supabase.from('branch_financial_reports')
      .select('branch_id, total_income, total_expense, branches(name)')
      .in('status', ['approved', 'submitted'])
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(50),
    // Monthly trend data
    supabase.from('branch_financial_reports')
      .select('period_year, period_month, total_income, total_expense, net_profit')
      .in('status', ['approved', 'submitted'])
      .order('period_year', { ascending: true })
      .order('period_month', { ascending: true })
      .limit(12),
    // Pending reports for review
    supabase.from('branch_financial_reports')
      .select('id, period_year, period_month, branches(name), submitted_at')
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false })
      .limit(5),
  ])

  const totalIncome  = (incomeData ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const totalExpense = (expenseData ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const netProfit    = totalIncome - totalExpense

  // Prepare branch revenue chart data: keep latest report per branch
  const latestPerBranch = Object.values(
    (branchReports ?? []).reduce((acc, r) => {
      if (!acc[r.branch_id]) acc[r.branch_id] = r
      return acc
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }, {} as Record<string, any>)
  ).map(r => ({
    name: (r.branches as { name: string })?.name?.slice(0, 14) ?? '—',
    pemasukan: Number(r.total_income),
    pengeluaran: Number(r.total_expense),
  })) as BranchRevenueData[]

  // Prepare monthly trend data: aggregate all branches per month
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trendByMonth: Record<string, any> = {}
  for (const r of (monthlyTrend ?? [])) {
    const key = `${r.period_year}-${String(r.period_month).padStart(2, '0')}`
    if (!trendByMonth[key]) {
      trendByMonth[key] = {
        label: MONTH_NAMES[(r.period_month ?? 1) - 1],
        income: 0,
        expense: 0,
        profit: 0,
      }
    }
    trendByMonth[key].income  += Number(r.total_income)
    trendByMonth[key].expense += Number(r.total_expense)
    trendByMonth[key].profit  += Number(r.net_profit)
  }
  const trendData = Object.values(trendByMonth).slice(-6) as MonthlyTrendData[]

  // Format date for header
  const now = new Date()
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6 relative">
      {/* Decorative gradient blob */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Ringkasan kinerja seluruh cabang</p>
        </div>
        <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-2xl">
          {dateStr}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <GlassStatCard
          title="Total Pasien"
          value={totalPatients ?? 0}
          icon={<Users size={16} className="text-white" />}
          color="bg-primary"
        />
        <GlassStatCard
          title="Staff Aktif"
          value={totalStaff ?? 0}
          icon={<Users size={16} className="text-white" />}
          color="bg-[var(--chart-2)]"
        />
        <GlassStatCard
          title="Cabang Aktif"
          value={activeBranches ?? 0}
          icon={<Building2 size={16} className="text-white" />}
          color="bg-[var(--chart-3)]"
        />
        <GlassStatCard
          title="Total Pemasukan"
          value={formatRp(totalIncome)}
          icon={<TrendingUp size={16} className="text-white" />}
          color="bg-[var(--chart-4)]"
          sub="Semua cabang dikonfirmasi"
        />
        <GlassStatCard
          title="Laba Bersih"
          value={formatRp(netProfit)}
          icon={netProfit >= 0
            ? <DollarSign size={16} className="text-white" />
            : <TrendingDown size={16} className="text-white" />}
          color={netProfit >= 0 ? 'bg-[var(--chart-4)]' : 'bg-destructive'}
          sub={netProfit >= 0 ? 'Untung' : 'Rugi'}
        />
      </div>

      {/* Charts */}
      <ChartsSection branchData={latestPerBranch} trendData={trendData} />

      {/* Pending Reports */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Laporan Menunggu Persetujuan</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Laporan bulanan yang perlu ditinjau</p>
          </div>
          {(pendingReports?.length ?? 0) > 0 && (
            <Link
              href="/director/reports"
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Lihat semua →
            </Link>
          )}
        </div>

        {!pendingReports?.length ? (
          <div className="flex items-center gap-3 py-6 px-4 bg-muted/30 rounded-2xl">
            <div className="w-8 h-8 rounded-2xl bg-chart-4/15 flex items-center justify-center shrink-0">
              <TrendingUp size={16} className="text-chart-4" style={{ color: 'var(--chart-4)' }} />
            </div>
            <p className="text-sm text-muted-foreground">Semua laporan sudah ditinjau. Tidak ada yang menunggu.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingReports.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-3 px-4 bg-muted/20 rounded-2xl hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-2xl bg-secondary/20 flex items-center justify-center shrink-0">
                    <Building2 size={14} className="text-secondary-foreground" />
                  </div>
                  <div>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <p className="text-sm font-medium text-foreground">{(r.branches as any)?.name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {MONTH_NAMES[(r.period_month ?? 1) - 1]} {r.period_year}
                    </p>
                  </div>
                </div>
                <Link
                  href="/director/reports"
                  className="text-xs font-medium px-3 py-1.5 rounded-xl bg-secondary/20 text-secondary-foreground hover:bg-secondary/30 transition-colors"
                >
                  Tinjau
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
