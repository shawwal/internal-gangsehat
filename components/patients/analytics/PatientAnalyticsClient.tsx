'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft, BarChart2, PieChart, Users, UserPlus, Activity } from 'lucide-react'
import type { ChartDataItem, TrendDataItem } from './PatientCharts'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PatientAnalyticsSummary {
  id: string
  gender: 'male' | 'female' | 'other' | null
  birthYear: number | null
  createdAt: string
  isActive: boolean
  agama: string | null
  provinsi: string | null
}

export interface VisitAnalyticsSummary {
  patientId: string
  visitDate: string
  serviceType: string | null
  status: string | null
}

interface Props {
  patients: PatientAnalyticsSummary[]
  visits: VisitAnalyticsSummary[]
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 2022 + 1 }, (_, i) => CURRENT_YEAR - i)
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

const GENDER_COLORS: Record<string, string> = {
  male: '#007AFF',
  female: '#FF0090',
  other: '#FFB35C',
}

const AGE_COLORS = ['#007AFF', '#34C759', '#FF0090', '#FFB35C', '#00C7BE']

const SERVICE_COLORS = ['#FF0090', '#007AFF', '#34C759', '#FFB35C', '#00C7BE', '#FF3B30', '#8B5CF6']

const PALETTE = ['#FF0090', '#007AFF', '#34C759', '#FFB35C', '#00C7BE', '#FF3B30', '#8B5CF6']

// ─── Dynamic Chart Import ──────────────────────────────────────────────────────

const PatientCharts = dynamic(
  () => import('./PatientCharts'),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card h-72 animate-pulse rounded-3xl" />
          <div className="glass-card h-72 animate-pulse rounded-3xl" />
        </div>
        <div className="glass-card h-64 animate-pulse rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card h-64 animate-pulse rounded-3xl" />
          <div className="glass-card h-64 animate-pulse rounded-3xl" />
        </div>
      </div>
    ),
  }
)

// ─── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, colorClass, sub,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  colorClass: string
  sub?: string
}) {
  return (
    <div className="glass-card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 ${colorClass}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ─── Period helpers ─────────────────────────────────────────────────────────────

function inPeriod(dateStr: string, viewMode: 'monthly' | 'yearly', year: number, month: number): boolean {
  const d = new Date(dateStr)
  if (viewMode === 'monthly') return d.getFullYear() === year && d.getMonth() + 1 === month
  return d.getFullYear() === year
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function PatientAnalyticsClient({ patients, visits }: Props) {
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('yearly')
  const [year, setYear]         = useState(CURRENT_YEAR)
  const [month, setMonth]       = useState(new Date().getMonth() + 1)
  const [chartType, setChartType] = useState<'pie' | 'bar'>('bar')

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:         patients.length,
    newThisPeriod: patients.filter(p => inPeriod(p.createdAt, viewMode, year, month)).length,
    active:        patients.filter(p => p.isActive).length,
    male:          patients.filter(p => p.gender === 'male').length,
    female:        patients.filter(p => p.gender === 'female').length,
    other:         patients.filter(p => p.gender === 'other' || !p.gender).length,
  }), [patients, viewMode, year, month])

  // ── Gender ─────────────────────────────────────────────────────────────────
  const genderData: ChartDataItem[] = useMemo(() => {
    const items = [
      { name: 'Laki-laki', value: stats.male,   color: GENDER_COLORS.male },
      { name: 'Perempuan', value: stats.female,  color: GENDER_COLORS.female },
      { name: 'Lainnya',   value: stats.other,   color: GENDER_COLORS.other },
    ]
    return items.filter(d => d.value > 0)
  }, [stats])

  // ── Age Groups ─────────────────────────────────────────────────────────────
  const ageData: ChartDataItem[] = useMemo(() => {
    const buckets = [
      { name: 'Anak (0–12)',      min: 0,  max: 12,  color: AGE_COLORS[0] },
      { name: 'Remaja (13–25)',   min: 13, max: 25,  color: AGE_COLORS[1] },
      { name: 'Dewasa (26–40)',   min: 26, max: 40,  color: AGE_COLORS[2] },
      { name: 'Paruh Baya (41–60)', min: 41, max: 60, color: AGE_COLORS[3] },
      { name: 'Lansia (60+)',     min: 61, max: 999, color: AGE_COLORS[4] },
    ]
    const counts = buckets.map(b => ({ ...b, value: 0 }))
    patients.forEach(p => {
      if (!p.birthYear) return
      const age = CURRENT_YEAR - p.birthYear
      const bucket = counts.find(b => age >= b.min && age <= b.max)
      if (bucket) bucket.value++
    })
    return counts.filter(d => d.value > 0).map(({ name, value, color }) => ({ name, value, color }))
  }, [patients])

  // ── Registration Trend ────────────────────────────────────────────────────
  const trendData: TrendDataItem[] = useMemo(() => {
    if (viewMode === 'monthly') {
      const months = MONTHS.map((label, i) => ({ label, count: 0, month: i + 1 }))
      patients.forEach(p => {
        const d = new Date(p.createdAt)
        if (d.getFullYear() === year) months[d.getMonth()].count++
      })
      return months
    }
    // Yearly: last 5 years
    const start = year - 4
    const years = Array.from({ length: 5 }, (_, i) => start + i)
    const map: Record<number, number> = {}
    years.forEach(y => (map[y] = 0))
    patients.forEach(p => {
      const y = new Date(p.createdAt).getFullYear()
      if (map[y] !== undefined) map[y]++
    })
    return years.map(y => ({ label: y.toString(), count: map[y] }))
  }, [patients, viewMode, year])

  // ── Service Type ──────────────────────────────────────────────────────────
  const serviceData: ChartDataItem[] = useMemo(() => {
    const filtered = visits.filter(v => inPeriod(v.visitDate, viewMode, year, month))
    const counts: Record<string, number> = {}
    filtered.forEach(v => {
      const st = v.serviceType ?? 'LAINNYA'
      counts[st] = (counts[st] ?? 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, color: SERVICE_COLORS[i] ?? '#8B5CF6' }))
  }, [visits, viewMode, year, month])

  // ── Religion ──────────────────────────────────────────────────────────────
  const religionData: ChartDataItem[] = useMemo(() => {
    const counts: Record<string, number> = {}
    patients.forEach(p => {
      const r = p.agama ?? 'Tidak Diketahui'
      counts[r] = (counts[r] ?? 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }))
  }, [patients])

  // ── Province ──────────────────────────────────────────────────────────────
  const provinceData: ChartDataItem[] = useMemo(() => {
    const counts: Record<string, number> = {}
    patients.forEach(p => {
      if (!p.provinsi) return
      counts[p.provinsi] = (counts[p.provinsi] ?? 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }))
  }, [patients])

  // ── Period label ──────────────────────────────────────────────────────────
  const periodLabel = viewMode === 'monthly'
    ? `${MONTHS[month - 1]} ${year}`
    : `Tahun ${year}`

  return (
    <div className="space-y-6 relative">
      {/* Gradient blob */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/director/overview"
            className="w-9 h-9 rounded-2xl bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Kembali ke overview"
          >
            <ArrowLeft size={16} className="text-foreground/70" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">Analitik Pasien</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Infografis & statistik demografi pasien</p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-muted/60 rounded-2xl p-1 gap-0.5">
            {(['yearly', 'monthly'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  viewMode === mode
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode === 'yearly' ? 'Tahunan' : 'Bulanan'}
              </button>
            ))}
          </div>

          {/* Year Select */}
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2 rounded-2xl text-xs font-medium bg-muted/60 border-none outline-none text-foreground cursor-pointer hover:bg-muted transition-colors"
          >
            {YEARS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Month Select (only monthly) */}
          {viewMode === 'monthly' && (
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="px-3 py-2 rounded-2xl text-xs font-medium bg-muted/60 border-none outline-none text-foreground cursor-pointer hover:bg-muted transition-colors"
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          )}

          {/* Chart Type Toggle */}
          <div className="flex items-center bg-muted/60 rounded-2xl p-1 gap-0.5">
            <button
              onClick={() => setChartType('bar')}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                chartType === 'bar'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label="Bar chart"
            >
              <BarChart2 size={14} />
            </button>
            <button
              onClick={() => setChartType('pie')}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                chartType === 'pie'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label="Pie chart"
            >
              <PieChart size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Period Badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium px-3 py-1.5 rounded-2xl bg-primary/10 text-primary">
          {periodLabel}
        </span>
        <span className="text-xs text-muted-foreground">
          · {stats.total.toLocaleString('id-ID')} total pasien
        </span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Total Pasien"
          value={stats.total.toLocaleString('id-ID')}
          icon={<Users size={15} className="text-white" />}
          colorClass="bg-primary"
        />
        <StatCard
          label="Pasien Baru"
          value={stats.newThisPeriod.toLocaleString('id-ID')}
          icon={<UserPlus size={15} className="text-white" />}
          colorClass="bg-[var(--chart-5)]"
          sub={periodLabel}
        />
        <StatCard
          label="Pasien Aktif"
          value={stats.active.toLocaleString('id-ID')}
          icon={<Activity size={15} className="text-white" />}
          colorClass="bg-[var(--chart-4)]"
          sub={`${Math.round((stats.active / Math.max(stats.total, 1)) * 100)}% dari total`}
        />
        <StatCard
          label="Laki-laki"
          value={stats.male.toLocaleString('id-ID')}
          icon={<Users size={15} className="text-white" />}
          colorClass="bg-[var(--chart-5)]"
          sub={`${Math.round((stats.male / Math.max(stats.total, 1)) * 100)}%`}
        />
        <StatCard
          label="Perempuan"
          value={stats.female.toLocaleString('id-ID')}
          icon={<Users size={15} className="text-white" />}
          colorClass="bg-primary"
          sub={`${Math.round((stats.female / Math.max(stats.total, 1)) * 100)}%`}
        />
        <StatCard
          label="Lainnya"
          value={stats.other.toLocaleString('id-ID')}
          icon={<Users size={15} className="text-white" />}
          colorClass="bg-[var(--chart-2)]"
          sub={`${Math.round((stats.other / Math.max(stats.total, 1)) * 100)}%`}
        />
      </div>

      {/* Charts */}
      <PatientCharts
        genderData={genderData}
        ageData={ageData}
        trendData={trendData}
        serviceData={serviceData}
        religionData={religionData}
        provinceData={provinceData}
        chartType={chartType}
        viewMode={viewMode}
      />
    </div>
  )
}
