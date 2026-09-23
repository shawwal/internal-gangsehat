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
    // Icon-over-text and stacked on mobile — side-by-side squeezed the label into
    // a too-narrow column at 3-up on a phone (e.g. "Total Kunjungan Selesai"
    // wrapped to 3 lines and crowded the card edge). From `sm:` up there's room
    // for the original horizontal layout.
    <div className="glass-card p-3 sm:p-4 flex flex-col items-center text-center gap-1.5 sm:flex-row sm:items-center sm:text-left sm:gap-4">
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        {loading ? (
          <div className="h-6 w-10 bg-muted animate-pulse rounded mx-auto sm:mx-0" />
        ) : (
          <p className="text-xl sm:text-2xl font-bold text-foreground leading-none">{value}</p>
        )}
        <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-tight">{label}</p>
      </div>
    </div>
  )
}

export function MedicalRecordsStats({ complete, incomplete, loading }: Props) {
  const total = complete + incomplete
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      <StatCard label="Total Kunjungan Selesai" value={total}
        icon={<ClipboardList size={18} className="text-foreground" />} color="bg-muted" loading={loading} />
      <StatCard label="Belum Lengkap" value={incomplete}
        icon={<AlertTriangle size={18} className="text-amber-500" />} color="bg-amber-500/15" loading={loading} />
      <StatCard label="Lengkap" value={complete}
        icon={<CheckCircle2 size={18} className="text-[#34C759]" />} color="bg-[#34C759]/15" loading={loading} />
    </div>
  )
}
