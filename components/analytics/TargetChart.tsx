import React from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { ChartCard } from './ChartCard'
import { CustomTooltip } from './CustomTooltip'
import type { MonthlyTarget } from './types'

interface TargetChartProps {
  data: MonthlyTarget[]
  year: number
  chartType: 'bar' | 'line'
}

export function TargetChart({ data, year, chartType }: TargetChartProps) {
  const title = 'Target Staff Bulanan'
  const sub = `Status target staff per bulan tahun ${year}`

  if (chartType === 'line') {
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
