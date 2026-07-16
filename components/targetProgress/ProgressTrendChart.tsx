'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { cumulative } from './utils'
import type { CategorySummary } from './types'

interface ProgressTrendChartProps {
  summaries: CategorySummary[]
  days: number
}

interface ChartPoint {
  day: number
  pace: number
  [key: string]: number
}

function TrendTooltip({ active, payload, label, summaries }: {
  active?: boolean
  payload?: { dataKey: string; value: number; color: string }[]
  label?: number
  summaries: CategorySummary[]
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '10px 14px',
        fontSize: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      }}
    >
      <p style={{ color: 'var(--foreground)', fontWeight: 600, marginBottom: 6 }}>
        Hari ke-{label}
      </p>
      {payload.filter(p => p.dataKey !== 'pace').map(p => {
        const s = summaries.find(x => x.key === p.dataKey)
        if (!s) return null
        return (
          <p key={p.dataKey} style={{ color: s.color, marginBottom: 2 }}>
            {s.label}: {p.value.toFixed(0)}%
          </p>
        )
      })}
    </div>
  )
}

export function ProgressTrendChart({ summaries, days }: ProgressTrendChartProps) {
  const hasTarget = summaries.some(s => s.target > 0)

  if (!hasTarget) {
    return (
      <div className="glass-card p-4">
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
          Belum ada target disetujui untuk bulan ini
        </div>
      </div>
    )
  }

  const data: ChartPoint[] = Array.from({ length: days }, (_, i) => {
    const day = i + 1
    const point: ChartPoint = { day, pace: (day / days) * 100 }
    for (const s of summaries) {
      const cum = cumulative(s.daily)[i]
      point[s.key] = s.target ? (cum / s.target) * 100 : 0
    }
    return point
  })

  return (
    <div className="glass-card p-4">
      <div className="mb-2">
        <p className="text-sm font-semibold text-foreground">Progress Kumulatif</p>
        <p className="text-xs text-muted-foreground">% target tercapai per hari, dibanding pace ideal</p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 20, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}%`}
          />
          <Tooltip content={<TrendTooltip summaries={summaries} />} />
          <Legend
            formatter={(value: string) => {
              const s = summaries.find(x => x.key === value)
              return <span style={{ color: 'var(--foreground)', fontSize: 12 }}>{s?.label ?? value}</span>
            }}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="pace"
            name="Pace Ideal"
            stroke="var(--muted-foreground)"
            strokeDasharray="5 3"
            strokeWidth={1.5}
            dot={false}
            legendType="none"
          />
          {summaries.map(s => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.key}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
