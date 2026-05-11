'use client'

import dynamic from 'next/dynamic'
import type { BranchRevenueData } from './BranchRevenueChart'
import type { MonthlyTrendData } from './MonthlyTrendChart'

const BranchRevenueChart = dynamic(
  () => import('./BranchRevenueChart').then(m => ({ default: m.BranchRevenueChart })),
  { ssr: false, loading: () => <div className="glass-card h-72 animate-pulse rounded-3xl" /> }
)

const MonthlyTrendChart = dynamic(
  () => import('./MonthlyTrendChart').then(m => ({ default: m.MonthlyTrendChart })),
  { ssr: false, loading: () => <div className="glass-card h-64 animate-pulse rounded-3xl" /> }
)

interface Props {
  branchData: BranchRevenueData[]
  trendData: MonthlyTrendData[]
}

export function ChartsSection({ branchData, trendData }: Props) {
  return (
    <>
      <BranchRevenueChart data={branchData} />
      <MonthlyTrendChart data={trendData} />
    </>
  )
}
