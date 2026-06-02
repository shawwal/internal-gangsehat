'use client'

import { Building2, CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { TargetStats } from './types'

interface Props {
  stats: TargetStats
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="glass-card p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  )
}

export function BranchTargetStats({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Pengajuan"
        value={stats.total}
        icon={<Building2 size={18} className="text-foreground/70" />}
        color="bg-muted"
      />
      <StatCard
        label="Menunggu"
        value={stats.pending}
        icon={<Clock size={18} className="text-secondary" />}
        color="bg-secondary/20"
      />
      <StatCard
        label="Disetujui"
        value={stats.approved}
        icon={<CheckCircle2 size={18} className="text-chart-4" />}
        color="bg-chart-4/15"
      />
      <StatCard
        label="Ditolak"
        value={stats.rejected}
        icon={<XCircle size={18} className="text-destructive" />}
        color="bg-destructive/10"
      />
    </div>
  )
}
