'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { ChartCard } from './ChartCard'
import type { FisioBarData } from './types'
import { getFirstName } from './utils'

interface FisioBarChartProps {
  data: FisioBarData[]
  avgTarget: number
}

function FisioTooltip({ active, payload, label, data }: any) {
  if (!active || !payload?.length) return null
  const entry = (data as FisioBarData[]).find(d => getFirstName(d.fullName) === label)
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
      <p style={{ color: 'var(--foreground)', fontWeight: 600, marginBottom: 4 }}>
        {entry?.fullName ?? label}
      </p>
      <p style={{ color: 'var(--primary)' }}>
        Terapi Awal: {payload[0]?.value ?? 0}
      </p>
    </div>
  )
}

export function FisioBarChart({ data, avgTarget }: FisioBarChartProps) {
  if (!data.length) {
    return (
      <ChartCard
        title="Terapi Awal per Fisio"
        subtitle="Jumlah terapi awal oleh setiap fisioterapis"
      >
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
          Belum ada data pada periode ini
        </div>
      </ChartCard>
    )
  }

  const chartData = data.map(d => ({
    name: getFirstName(d.fullName),
    ta: d.ta,
    fullName: d.fullName,
  }))

  return (
    <ChartCard
      title="Terapi Awal per Fisio"
      subtitle="Jumlah terapi awal oleh setiap fisioterapis"
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 8, left: -24, bottom: 0 }}
          barCategoryGap="32%"
        >
          <defs>
            <linearGradient id="perf-barTA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--primary)"  stopOpacity={1} />
              <stop offset="100%" stopColor="var(--primary)"  stopOpacity={0.45} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />

          <XAxis
            dataKey="name"
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

          <Tooltip content={<FisioTooltip data={data} />} />

          {avgTarget > 0 && (
            <ReferenceLine
              y={avgTarget}
              stroke="var(--secondary)"
              strokeDasharray="5 3"
              strokeWidth={2}
              label={{
                value: `Target (${avgTarget})`,
                position: 'insideTopRight',
                fontSize: 11,
                fill: 'var(--secondary)',
                fontWeight: 600,
              }}
            />
          )}

          <Bar
            dataKey="ta"
            name="Terapi Awal"
            fill="url(#perf-barTA)"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
