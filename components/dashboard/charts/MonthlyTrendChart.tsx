'use client'

import { TrendingUp } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

export interface MonthlyTrendData {
  label: string
  income: number
  expense: number
  profit: number
}

interface Props {
  data: MonthlyTrendData[]
}

function formatRpCompact(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

interface TooltipPayload {
  value: number
  name: string
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const labels: Record<string, string> = {
    income: 'Pemasukan',
    expense: 'Pengeluaran',
    profit: 'Laba Bersih',
  }
  return (
    <div style={{
      backgroundColor: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '10px 14px',
      fontSize: '12px',
    }}>
      <p style={{ color: 'var(--foreground)', fontWeight: 600, marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {labels[p.name] ?? p.name}: {formatRpCompact(p.value)}
        </p>
      ))}
    </div>
  )
}

export function MonthlyTrendChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="glass-card p-5">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-foreground">Tren Keuangan 6 Bulan Terakhir</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Agregat seluruh cabang</p>
        </div>
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-12 h-12 rounded-3xl bg-muted/50 flex items-center justify-center mb-3">
            <TrendingUp size={22} className="text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Belum ada data tren</p>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
            Tren akan muncul setelah minimal 1 laporan bulanan disetujui
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-5">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-foreground">Tren Keuangan 6 Bulan Terakhir</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Agregat seluruh cabang</p>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatRpCompact}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Line
            type="monotone"
            dataKey="income"
            stroke="var(--chart-4)"
            strokeWidth={2.5}
            dot={{ r: 4, fill: 'var(--chart-4)', strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="expense"
            stroke="var(--destructive)"
            strokeWidth={2.5}
            strokeDasharray="5 3"
            dot={{ r: 4, fill: 'var(--destructive)', strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="profit"
            stroke="var(--primary)"
            strokeWidth={2.5}
            dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 rounded inline-block" style={{ backgroundColor: 'var(--chart-4)' }} />
          Pemasukan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 rounded inline-block" style={{ backgroundColor: 'var(--destructive)' }} />
          Pengeluaran
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 rounded inline-block" style={{ backgroundColor: 'var(--primary)' }} />
          Laba Bersih
        </span>
      </div>
    </div>
  )
}
