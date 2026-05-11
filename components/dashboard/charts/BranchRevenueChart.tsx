'use client'

import { BarChart2 } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface BranchRevenueData {
  name: string
  pemasukan: number
  pengeluaran: number
}

interface Props {
  data: BranchRevenueData[]
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
          {p.name === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}: {formatRpCompact(p.value)}
        </p>
      ))}
    </div>
  )
}

export function BranchRevenueChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="glass-card p-5">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-foreground">Perbandingan Pendapatan per Cabang</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Berdasarkan laporan terbaru yang disetujui</p>
        </div>
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-12 h-12 rounded-3xl bg-muted/50 flex items-center justify-center mb-3">
            <BarChart2 size={22} className="text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Belum ada data laporan</p>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
            Data akan muncul setelah laporan bulanan cabang disetujui
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Perbandingan Pendapatan per Cabang</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Berdasarkan laporan terbaru yang disetujui</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: 'var(--chart-4)' }} />
            Pemasukan
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: 'var(--destructive)' }} />
            Pengeluaran
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
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
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4, radius: 6 }} />
          <Bar
            dataKey="pemasukan"
            fill="var(--chart-4)"
            radius={[6, 6, 0, 0]}
          />
          <Bar
            dataKey="pengeluaran"
            fill="var(--destructive)"
            radius={[6, 6, 0, 0]}
            fillOpacity={0.85}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
