import { MONTH_NAMES } from './utils'
import type { BranchRevenueData } from '@/components/dashboard/charts/BranchRevenueChart'
import type { MonthlyTrendData } from '@/components/dashboard/charts/MonthlyTrendChart'

// ── Transaction-based builders (replaces branch_financial_reports approach) ──

export function buildTrendFromTransactions(
  transactions: { amount: number; type: string; transaction_date: string }[] | null,
): MonthlyTrendData[] {
  const byMonth: Record<string, { label: string; income: number; expense: number; profit: number }> = {}

  for (const tx of transactions ?? []) {
    const d   = new Date(tx.transaction_date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!byMonth[key]) {
      byMonth[key] = {
        label:   `${MONTH_NAMES[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`,
        income:  0,
        expense: 0,
        profit:  0,
      }
    }
    if (tx.type === 'income')  byMonth[key].income  += Number(tx.amount)
    if (tx.type === 'expense') byMonth[key].expense += Number(tx.amount)
  }

  for (const v of Object.values(byMonth)) v.profit = v.income - v.expense

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)
    .slice(-12)
}

export function buildBranchChartFromTransactions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transactions: any[] | null,
): BranchRevenueData[] {
  const byBranch: Record<string, { name: string; pemasukan: number; pengeluaran: number }> = {}

  for (const tx of transactions ?? []) {
    const bid = tx.branch_id as string
    if (!byBranch[bid]) {
      byBranch[bid] = {
        name:        (tx.branches as { name: string } | null)?.name?.slice(0, 16) ?? '—',
        pemasukan:   0,
        pengeluaran: 0,
      }
    }
    if (tx.type === 'income')  byBranch[bid].pemasukan   += Number(tx.amount)
    if (tx.type === 'expense') byBranch[bid].pengeluaran += Number(tx.amount)
  }

  return Object.values(byBranch).sort((a, b) => b.pemasukan - a.pemasukan)
}

// ── Legacy helpers (kept for compatibility) ─────────────────────────────────

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
    name:        (r.branches as { name: string })?.name?.slice(0, 14) ?? '—',
    pemasukan:   Number(r.total_income),
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
