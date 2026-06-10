'use client'

import { useState } from 'react'
import { BarChart2 } from 'lucide-react'
import { useBranches, useKpi, useChartData } from '@/components/analytics/useAnalyticsData'
import { KpiCards } from '@/components/analytics/KpiCards'
import { FilterBar } from '@/components/analytics/FilterBar'
import { ChartSkeleton } from '@/components/analytics/Skeletons'
import { FinanceChart } from '@/components/analytics/FinanceChart'
import { VisitChart } from '@/components/analytics/VisitChart'
import { BranchChart } from '@/components/analytics/BranchChart'
import { TargetChart } from '@/components/analytics/TargetChart'
import { CURRENT_YEAR } from '@/components/analytics/constants'
import type { Tab, ChartType } from '@/components/analytics/types'

export default function DirectorAnalyticsPage() {
  const [tab, setTab] = useState<Tab>('keuangan')
  const [year, setYear] = useState(CURRENT_YEAR)
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const [chartType, setChartType] = useState<ChartType>('bar')

  const { branches } = useBranches()
  const { kpi, kpiLoading } = useKpi(year, branchFilter)
  const { financeData, visitData, branchData, targetData, chartLoading } = useChartData(tab, year, branchFilter)

  // Pie only makes sense for cabang
  const effectiveChartType: ChartType = (tab !== 'cabang' && chartType === 'pie') ? 'bar' : chartType

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
      <KpiCards kpi={kpi} kpiLoading={kpiLoading} year={year} />

      {/* Filter bar + Tabs */}
      <FilterBar
        tab={tab}
        setTab={setTab}
        branches={branches}
        branchFilter={branchFilter}
        setBranchFilter={setBranchFilter}
        year={year}
        setYear={setYear}
        chartType={chartType}
        setChartType={setChartType}
      />

      {/* Chart */}
      {chartLoading ? (
        <ChartSkeleton />
      ) : (
        <>
          {tab === 'keuangan' && <FinanceChart data={financeData} year={year} chartType={effectiveChartType === 'pie' ? 'bar' : effectiveChartType} />}
          {tab === 'kunjungan' && <VisitChart data={visitData} year={year} chartType={effectiveChartType === 'pie' ? 'bar' : effectiveChartType} />}
          {tab === 'cabang' && <BranchChart data={branchData} year={year} chartType={chartType} />}
          {tab === 'target' && <TargetChart data={targetData} year={year} chartType={effectiveChartType === 'pie' ? 'bar' : effectiveChartType} />}
        </>
      )}
    </div>
  )
}
