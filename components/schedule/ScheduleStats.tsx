'use client'

import { CalendarDays, CheckCircle2, XCircle } from 'lucide-react'

interface Props {
  total: number
  totalMasuk: number
  totalOff: number
  loading: boolean
  onMasukClick?: () => void
  onOffClick?: () => void
}

function StatCard({
  label, value, icon, color, onClick,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  onClick?: () => void
}) {
  const interactive = !!onClick
  return (
    <div
      onClick={onClick}
      className={[
        'bg-card rounded-2xl border border-border p-3 flex items-center gap-3 transition-all',
        interactive ? 'cursor-pointer hover:border-primary/30 hover:shadow-sm hover:bg-muted/30' : '',
      ].join(' ')}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-foreground leading-none">{value}</p>
        <p className={`text-xs mt-0.5 ${interactive ? 'text-primary' : 'text-muted-foreground'}`}>
          {label}
          {interactive && <span className="ml-1 opacity-60">↗</span>}
        </p>
      </div>
    </div>
  )
}

export function ScheduleStats({ total, totalMasuk, totalOff, loading, onMasukClick, onOffClick }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-15 bg-muted animate-pulse rounded-2xl" />
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
        onClick={onMasukClick}
      />
      <StatCard
        label="OFF"
        value={totalOff}
        icon={<XCircle size={16} className="text-[#FF3B30]" />}
        color="bg-[#FF3B30]/10"
        onClick={onOffClick}
      />
    </div>
  )
}
