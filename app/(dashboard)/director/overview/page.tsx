import { createClient } from '@/lib/supabase/server'
import { ChartsSection } from '@/components/dashboard/charts/ChartsSection'
import { KpiCards } from '@/components/overview/KpiCards'
import { PendingTargets } from '@/components/overview/PendingTargets'
import { PendingReports } from '@/components/overview/PendingReports'
import { computeKpi, buildBranchChartData, buildTrendData } from '@/components/overview/dataHelpers'

export const dynamic = 'force-dynamic'

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
    { data: pendingTargets },
  ] = await Promise.all([
    supabase.from('patients').select('id', { count: 'exact', head: true }),
    supabase.from('internal_profiles').select('id', { count: 'exact', head: true }).eq('is_active', true).neq('role', 'staff'),
    supabase.from('branches').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('transactions').select('amount').eq('type', 'income').eq('status', 'confirmed'),
    supabase.from('transactions').select('amount').eq('type', 'expense').eq('status', 'confirmed'),
    supabase.from('branch_financial_reports')
      .select('branch_id, total_income, total_expense, branches(name)')
      .in('status', ['approved', 'submitted'])
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(50),
    supabase.from('branch_financial_reports')
      .select('period_year, period_month, total_income, total_expense, net_profit')
      .in('status', ['approved', 'submitted'])
      .order('period_year', { ascending: true })
      .order('period_month', { ascending: true })
      .limit(12),
    supabase.from('branch_financial_reports')
      .select('id, period_year, period_month, branches(name), submitted_at')
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false })
      .limit(5),
    supabase.from('staff_targets')
      .select('id, bulan, tahun, internal_profiles(full_name), branches(name), created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const { totalIncome, netProfit } = computeKpi(incomeData, expenseData)
  const branchData = buildBranchChartData(branchReports)
  const trendData  = buildTrendData(monthlyTrend)

  const dateStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-6 relative">
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

      <KpiCards
        totalPatients={totalPatients ?? 0}
        totalStaff={totalStaff ?? 0}
        activeBranches={activeBranches ?? 0}
        totalIncome={totalIncome}
        netProfit={netProfit}
      />

      <ChartsSection branchData={branchData} trendData={trendData} />

      <PendingTargets pendingTargets={pendingTargets ?? []} />
      <PendingReports pendingReports={pendingReports ?? []} />
    </div>
  )
}
