'use client'

import { CheckCircle2, Clock, Users, XCircle } from 'lucide-react'
import type { LeaveStats } from './types'

interface Props {
  stats: LeaveStats
}

function GlassStatCard({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode; color: string
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

export function LeaveStats({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <GlassStatCard label="Total Pengajuan" value={stats.total}
        icon={<Users size={18} className="text-foreground" />} color="bg-muted" />
      <GlassStatCard label="Menunggu" value={stats.pending}
        icon={<Clock size={18} className="text-secondary-foreground" />} color="bg-secondary/20" />
      <GlassStatCard label="Disetujui" value={stats.approved}
        icon={<CheckCircle2 size={18} className="text-chart-4" />} color="bg-chart-4/15" />
      <GlassStatCard label="Ditolak" value={stats.rejected}
        icon={<XCircle size={18} className="text-destructive" />} color="bg-destructive/10" />
    </div>
  )
}
