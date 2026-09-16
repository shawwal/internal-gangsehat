'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import type { TherapistPerforma } from './types'

interface Props {
  data: TherapistPerforma[]
}

interface PerformaTooltipProps {
  active?: boolean
  payload?: { value?: number }[]
  label?: string
  data: TherapistPerforma[]
}

function PerformaTooltip({ active, payload, label, data }: PerformaTooltipProps) {
  if (!active || !payload?.length) return null
  const entry = data.find((d) => (d.nickname || d.name).split(' ')[0] === label)
  const displayName = entry ? entry.nickname || entry.name : label
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
      <p style={{ color: 'var(--foreground)', fontWeight: 600, marginBottom: 4 }}>{displayName}</p>
      <p style={{ color: 'var(--primary)' }}>Total sesi: {payload[0]?.value ?? 0}</p>
    </div>
  )
}

export function SportMassageBarChart({ data }: Props) {
  if (!data.length) return null

  const chartData = data.map((d) => ({
    name: (d.nickname || d.name).split(' ')[0],
    total: d.total,
  }))

  return (
    <div className="glass-card p-5">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-foreground">Perbandingan Antar Terapis</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Total sesi hadir pada periode terpilih</p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 20, right: 8, left: -24, bottom: 0 }} barCategoryGap="32%">
          <defs>
            <linearGradient id="sm-performa-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.45} />
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

          <Tooltip content={<PerformaTooltip data={data} />} />

          <Bar dataKey="total" name="Total Sesi" fill="url(#sm-performa-bar)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
