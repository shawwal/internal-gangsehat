import React from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { ChartCard } from './ChartCard'
import { CustomTooltip } from './CustomTooltip'
import { formatRpCompact } from './utils'
import type { MonthlyFinance } from './types'

interface FinanceChartProps {
  data: MonthlyFinance[]
  year: number
  chartType: 'bar' | 'line'
}

export function FinanceChart({ data, year, chartType }: FinanceChartProps) {
  const title = 'Keuangan Bulanan'
  const sub = `Pemasukan, pengeluaran, dan laba bersih tahun ${year}`

  if (chartType === 'line') {
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
