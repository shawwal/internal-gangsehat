'use client'

import { CalendarDays, CheckCircle2, XCircle } from 'lucide-react'

interface Props {
  total: number
  totalMasuk: number
  totalOff: number
  loading: boolean
}

function StatCard({
  label, value, icon, color,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="bg-card rounded-2xl border border-border p-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  )
}

export function ScheduleStats({ total, totalMasuk, totalOff, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[60px] bg-muted animate-pulse rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard
        label="Total Jadwal"
        value={total}
        icon={<CalendarDays size={16} className="text-foreground" />}
        color="bg-muted"
      />
      <StatCard
        label="Masuk"
        value={totalMasuk}
        icon={<CheckCircle2 size={16} className="text-[#34C759]" />}
        color="bg-[#34C759]/15"
      />
      <StatCard
        label="OFF"
        value={totalOff}
        icon={<XCircle size={16} className="text-[#FF3B30]" />}
        color="bg-[#FF3B30]/10"
      />
    </div>
  )
}
