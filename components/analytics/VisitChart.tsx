import React from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { ChartCard } from './ChartCard'
import { CustomTooltip } from './CustomTooltip'
import type { MonthlyVisit } from './types'

interface VisitChartProps {
  data: MonthlyVisit[]
  year: number
  chartType: 'bar' | 'line'
}

export function VisitChart({ data, year, chartType }: VisitChartProps) {
  const title = 'Kunjungan Bulanan'
  const sub = `Jumlah kunjungan pasien per bulan tahun ${year}`

  if (chartType === 'line') {
    return (
      <ChartCard title={title} sub={sub}>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={50} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="Selesai" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Terjadwal" stroke="var(--secondary)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Dibatalkan" stroke="var(--destructive)" strokeWidth={2} dot={false} strokeDasharray="5 3" />
            <Line type="monotone" dataKey="Tidak Hadir" stroke="var(--muted-foreground)" strokeWidth={2} dot={false} strokeDasharray="3 3" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    )
  }

  return (
    <ChartCard title={title} sub={sub}>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barCategoryGap="28%">
          <defs>
            <linearGradient id="barSelesai" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={1}/>
              <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0.6}/>
            </linearGradient>
            <linearGradient id="barTerjadwal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--secondary)" stopOpacity={1}/>
              <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0.6}/>
            </linearGradient>
            <linearGradient id="barBatal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--destructive)" stopOpacity={1}/>
              <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.6}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={50} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Selesai" fill="url(#barSelesai)" radius={[5, 5, 0, 0]} />
          <Bar dataKey="Terjadwal" fill="url(#barTerjadwal)" radius={[5, 5, 0, 0]} />
          <Bar dataKey="Dibatalkan" fill="url(#barBatal)" radius={[5, 5, 0, 0]} />
          <Bar dataKey="Tidak Hadir" fill="var(--muted-foreground)" radius={[5, 5, 0, 0]} fillOpacity={0.5} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
