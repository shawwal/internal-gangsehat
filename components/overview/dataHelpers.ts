import { MONTH_NAMES } from './utils'
import type { BranchRevenueData } from '@/components/dashboard/charts/BranchRevenueChart'
import type { MonthlyTrendData } from '@/components/dashboard/charts/MonthlyTrendChart'

export function computeKpi(
  incomeData: { amount: number }[] | null,
  expenseData: { amount: number }[] | null,
) {
  const totalIncome  = (incomeData  ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const totalExpense = (expenseData ?? []).reduce((s, r) => s + Number(r.amount), 0)
  return { totalIncome, totalExpense, netProfit: totalIncome - totalExpense }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildBranchChartData(branchReports: any[] | null): BranchRevenueData[] {
  return Object.values(
    (branchReports ?? []).reduce((acc, r) => {
      if (!acc[r.branch_id]) acc[r.branch_id] = r
      return acc
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }, {} as Record<string, any>)
  ).map((r: any) => ({
    name: (r.branches as { name: string })?.name?.slice(0, 14) ?? '—',
    pemasukan: Number(r.total_income),
    pengeluaran: Number(r.total_expense),
  })) as BranchRevenueData[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildTrendData(monthlyTrend: any[] | null): MonthlyTrendData[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trendByMonth: Record<string, any> = {}
  for (const r of (monthlyTrend ?? [])) {
    const key = `${r.period_year}-${String(r.period_month).padStart(2, '0')}`
    if (!trendByMonth[key]) {
      trendByMonth[key] = {
        label: MONTH_NAMES[(r.period_month ?? 1) - 1],
        income: 0, expense: 0, profit: 0,
      }
    }
    trendByMonth[key].income  += Number(r.total_income)
    trendByMonth[key].expense += Number(r.total_expense)
    trendByMonth[key].profit  += Number(r.net_profit)
  }
  return Object.values(trendByMonth).slice(-6) as MonthlyTrendData[]
}
