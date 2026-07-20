'use client'

import { CheckCircle2, ClipboardList, AlertTriangle } from 'lucide-react'

interface Props {
  complete: number
  incomplete: number
  loading: boolean
}

function StatCard({ label, value, icon, color, loading }: {
  label: string; value: number; icon: React.ReactNode; color: string; loading: boolean
}) {
  return (
    <div className="glass-card p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        {loading ? (
          <div className="h-6 w-10 bg-muted animate-pulse rounded" />
        ) : (
          <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  )
}

export function MedicalRecordsStats({ complete, incomplete, loading }: Props) {
  const total = complete + incomplete
  return (
    <div className="grid grid-cols-3 gap-4">
      <StatCard label="Total Kunjungan Selesai" value={total}
        icon={<ClipboardList size={18} className="text-foreground" />} color="bg-muted" loading={loading} />
      <StatCard label="Belum Lengkap" value={incomplete}
        icon={<AlertTriangle size={18} className="text-amber-500" />} color="bg-amber-500/15" loading={loading} />
      <StatCard label="Lengkap" value={complete}
        icon={<CheckCircle2 size={18} className="text-[#34C759]" />} color="bg-[#34C759]/15" loading={loading} />
    </div>
  )
}
