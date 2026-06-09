'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { ChartCard } from './ChartCard'

interface MiniDataPoint {
  month: string
  value: number
}

interface ServiceMiniChartProps {
  title: string
  subtitle?: string
  data: MiniDataPoint[]
  color: string
  gradientId: string
}

export function ServiceMiniChart({
  title,
  subtitle,
  data,
  color,
  gradientId,
}: ServiceMiniChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      action={
        <span className="text-lg font-bold" style={{ color }}>
          {total.toLocaleString('id-ID')}
        </span>
      }
    >
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -32, bottom: 0 }} barCategoryGap="40%">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={0.4} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            interval={1}
          />
          <YAxis hide allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              fontSize: 11,
            }}
            formatter={(v) => [Number(v).toLocaleString('id-ID'), title]}
          />
          <Bar dataKey="value" name={title} fill={`url(#${gradientId})`} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
