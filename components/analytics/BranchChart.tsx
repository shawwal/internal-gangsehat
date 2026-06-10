import React from 'react'
import {
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { ChartCard } from './ChartCard'
import { CustomTooltip } from './CustomTooltip'
import { formatRpCompact } from './utils'
import { PIE_COLORS } from './constants'
import type { BranchData, ChartType } from './types'

interface BranchChartProps {
  data: BranchData[]
  year: number
  chartType: ChartType
}

export function BranchChart({ data, year, chartType }: BranchChartProps) {
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
