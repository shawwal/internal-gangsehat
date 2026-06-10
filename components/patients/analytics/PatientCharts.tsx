'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, AreaChart, Area,
} from 'recharts'
import { BarChart2 } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ChartDataItem {
  name: string
  value: number
  color?: string
}

export interface TrendDataItem {
  label: string
  count: number
}

export interface PatientChartsProps {
  genderData: ChartDataItem[]
  ageData: ChartDataItem[]
  trendData: TrendDataItem[]
  serviceData: ChartDataItem[]
  religionData: ChartDataItem[]
  provinceData: ChartDataItem[]
  chartType: 'pie' | 'bar'
  viewMode: 'monthly' | 'yearly'
}

// ─── Palette ───────────────────────────────────────────────────────────────────

const PALETTE = [
  '#FF0090', '#007AFF', '#34C759', '#FFB35C',
  '#00C7BE', '#FF3B30', '#8B5CF6', '#F97316',
]

// ─── Shared Tooltip ────────────────────────────────────────────────────────────

interface TooltipPayload {
  value: number
  name?: string
  color?: string
  payload?: { name: string; value: number }
}

interface TooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
  unit?: string
}

function GlassTooltip({ active, payload, label, unit = 'pasien' }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      backgroundColor: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '10px 14px',
      fontSize: '12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    }}>
      {label && <p style={{ color: 'var(--foreground)', fontWeight: 600, marginBottom: 4 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? 'var(--foreground)', marginBottom: 2 }}>
          {p.payload?.name ?? p.name ?? label}:{' '}
          <strong>{(p.value ?? 0).toLocaleString('id-ID')} {unit}</strong>
        </p>
      ))}
    </div>
  )
}

// ─── Pie Inner Label ───────────────────────────────────────────────────────────

interface PieLabelProps {
  cx: number; cy: number; midAngle: number
  innerRadius: number; outerRadius: number; percent: number
}

function PieInnerLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: PieLabelProps) {
  if (percent < 0.06) return null
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="w-10 h-10 rounded-2xl bg-muted/50 flex items-center justify-center">
        <BarChart2 size={18} className="text-muted-foreground/40" />
      </div>
      <p className="text-xs text-muted-foreground/60">{label}</p>
    </div>
  )
}

// ─── Shared Card Wrapper ───────────────────────────────────────────────────────

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

// ─── Gender Chart ──────────────────────────────────────────────────────────────

function GenderChart({ data, chartType }: { data: ChartDataItem[]; chartType: 'pie' | 'bar' }) {
  if (!data.length) return <EmptyChart label="Belum ada data jenis kelamin" />

  if (chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={88}
            dataKey="value"
            labelLine={false}
            label={PieInnerLabel as unknown as boolean}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color ?? PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip content={<GlassTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barCategoryGap="35%">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
        <Tooltip content={<GlassTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4, radius: 6 }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Age Group Chart ───────────────────────────────────────────────────────────

function AgeGroupChart({ data, chartType }: { data: ChartDataItem[]; chartType: 'pie' | 'bar' }) {
  if (!data.length) return <EmptyChart label="Belum ada data usia" />

  if (chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={88}
            dataKey="value"
            labelLine={false}
            label={PieInnerLabel as unknown as boolean}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color ?? PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip content={<GlassTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
        <Tooltip content={<GlassTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4, radius: 6 }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Registration Trend Chart ──────────────────────────────────────────────────

function RegistrationTrendChart({ data, viewMode }: { data: TrendDataItem[]; viewMode: 'monthly' | 'yearly' }) {
  if (!data.length) return <EmptyChart label="Belum ada data pendaftaran" />

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="patientGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#FF0090" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#FF0090" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: viewMode === 'monthly' ? 11 : 12, fill: 'var(--muted-foreground)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          content={<GlassTooltip unit="pasien baru" />}
          cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 2' }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#FF0090"
          strokeWidth={2.5}
          fill="url(#patientGrad)"
          dot={{ r: 4, fill: '#FF0090', strokeWidth: 0 }}
          activeDot={{ r: 6, fill: '#FF0090', stroke: 'var(--card)', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Service Type Chart ────────────────────────────────────────────────────────

function ServiceTypeChart({ data, chartType }: { data: ChartDataItem[]; chartType: 'pie' | 'bar' }) {
  if (!data.length) return <EmptyChart label="Belum ada data kunjungan pada periode ini" />

  if (chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={88}
            dataKey="value"
            labelLine={false}
            label={PieInnerLabel as unknown as boolean}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color ?? PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip content={<GlassTooltip unit="kunjungan" />} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          axisLine={false}
          tickLine={false}
          width={82}
        />
        <Tooltip content={<GlassTooltip unit="kunjungan" />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Religion Chart ────────────────────────────────────────────────────────────

function ReligionChart({ data, chartType }: { data: ChartDataItem[]; chartType: 'pie' | 'bar' }) {
  if (!data.length) return <EmptyChart label="Belum ada data agama" />

  if (chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={88}
            dataKey="value"
            labelLine={false}
            label={PieInnerLabel as unknown as boolean}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color ?? PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip content={<GlassTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip content={<GlassTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Province Chart ────────────────────────────────────────────────────────────

function ProvinceChart({ data }: { data: ChartDataItem[] }) {
  if (!data.length) return <EmptyChart label="Belum ada data provinsi" />

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          axisLine={false}
          tickLine={false}
          width={130}
        />
        <Tooltip content={<GlassTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
        <Bar dataKey="value" fill="var(--chart-5)" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Legend Dots ───────────────────────────────────────────────────────────────

function LegendDots({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-1">
      {items.slice(0, 6).map((item, i) => (
        <span key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
          {item.name}
        </span>
      ))}
    </div>
  )
}

// ─── Main Export ───────────────────────────────────────────────────────────────

export default function PatientCharts({
  genderData, ageData, trendData, serviceData, religionData, provinceData, chartType, viewMode,
}: PatientChartsProps) {
  return (
    <div className="space-y-4">
      {/* Row 1: Gender + Age */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Distribusi Jenis Kelamin" subtitle="Seluruh pasien terdaftar">
          <GenderChart data={genderData} chartType={chartType} />
          <LegendDots items={genderData.map(d => ({ name: d.name, color: d.color ?? '#999' }))} />
        </ChartCard>

        <ChartCard title="Distribusi Kelompok Usia" subtitle="Berdasarkan tanggal lahir">
          <AgeGroupChart data={ageData} chartType={chartType} />
          <LegendDots items={ageData.map(d => ({ name: d.name, color: d.color ?? '#999' }))} />
        </ChartCard>
      </div>

      {/* Row 2: Registration Trend */}
      <ChartCard
        title={viewMode === 'monthly' ? 'Pendaftaran Pasien Baru per Bulan' : 'Pendaftaran Pasien Baru per Tahun'}
        subtitle="Tren pertumbuhan pasien"
      >
        <RegistrationTrendChart data={trendData} viewMode={viewMode} />
      </ChartCard>

      {/* Row 3: Service Type + Religion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Distribusi Jenis Layanan" subtitle="Berdasarkan kunjungan pada periode ini">
          <ServiceTypeChart data={serviceData} chartType={chartType} />
          <LegendDots items={serviceData.map(d => ({ name: d.name, color: d.color ?? '#999' }))} />
        </ChartCard>

        <ChartCard title="Distribusi Agama" subtitle="Seluruh pasien terdaftar">
          <ReligionChart data={religionData} chartType={chartType} />
          <LegendDots items={religionData.map(d => ({ name: d.name, color: d.color ?? '#999' }))} />
        </ChartCard>
      </div>

      {/* Row 4: Province */}
      {provinceData.length > 0 && (
        <ChartCard title="Top Provinsi Asal Pasien" subtitle="8 provinsi terbanyak">
          <ProvinceChart data={provinceData} />
        </ChartCard>
      )}
    </div>
  )
}
