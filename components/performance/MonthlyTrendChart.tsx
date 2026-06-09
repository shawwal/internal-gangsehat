'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { ChartCard } from './ChartCard'
import { CustomTooltip } from './CustomTooltip'
import type { MonthlyData } from './types'

interface MonthlyTrendChartProps {
  data: MonthlyData[]
  year: number
}

export function MonthlyTrendChart({ data, year }: MonthlyTrendChartProps) {
  const hasData = data.some(d => d.total > 0)

  if (!hasData) {
    return (
      <ChartCard title="Tren Layanan Bulanan" subtitle={`Total layanan per bulan tahun ${year}`}>
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
          Belum ada data
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Tren Layanan Bulanan" subtitle={`Total layanan per bulan tahun ${year}`}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="total"
            name="Total Layanan"
            stroke="var(--primary)"
            strokeWidth={2.5}
            dot={{ fill: 'var(--primary)', r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="ta"
            name="Terapi Awal"
            stroke="var(--chart-4)"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="6 3"
          />
          <Line
            type="monotone"
            dataKey="paket"
            name="Paket"
            stroke="var(--secondary)"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="6 3"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
