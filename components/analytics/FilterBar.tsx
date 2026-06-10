import React from 'react'
import { TrendingUp, Stethoscope, Building2, Activity } from 'lucide-react'
import { YEARS } from './constants'
import type { Branch, Tab, ChartType } from './types'

interface FilterBarProps {
  tab: Tab
  setTab: (tab: Tab) => void
  branches: Branch[]
  branchFilter: string
  setBranchFilter: (v: string) => void
  year: number
  setYear: (y: number) => void
  chartType: ChartType
  setChartType: (ct: ChartType) => void
}

export function FilterBar({
  tab,
  setTab,
  branches,
  branchFilter,
  setBranchFilter,
  year,
  setYear,
  chartType,
  setChartType,
}: FilterBarProps) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'keuangan', label: 'Keuangan', icon: <TrendingUp size={15} /> },
    { id: 'kunjungan', label: 'Kunjungan', icon: <Stethoscope size={15} /> },
    { id: 'cabang', label: 'Per Cabang', icon: <Building2 size={15} /> },
    { id: 'target', label: 'Target', icon: <Activity size={15} /> },
  ]

  return (
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
  )
}
