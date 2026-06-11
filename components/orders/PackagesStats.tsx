'use client'

import { Package, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { StatCard } from './StatCard'
import type { PackageStats } from './types'

interface PackagesStatsProps {
  stats: PackageStats
  loading: boolean
}

export function PackagesStats({ stats, loading }: PackagesStatsProps) {
  const s = loading
    ? { activePackages: 0, overdueCount: 0, completedThisMonth: 0 }
    : stats

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatCard
        label="Paket Aktif"
        value={s.activePackages}
        icon={Package}
        color="bg-primary/10 text-primary"
      />
      <StatCard
        label="Perlu Tindak Lanjut (>14 hari)"
        value={s.overdueCount}
        icon={AlertTriangle}
        color="bg-destructive/10 text-destructive"
      />
      <StatCard
        label="Selesai Bulan Ini"
        value={s.completedThisMonth}
        icon={CheckCircle2}
        color="bg-chart-4/15 text-chart-4"
      />
    </div>
  )
}
