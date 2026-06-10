import {
  ClipboardList, Clock, CheckCircle, XCircle,
  Loader, CreditCard, BadgeCheck,
} from 'lucide-react'
import { StatCard } from './StatCard'
import type { Stats } from './types'

interface OrdersStatsProps {
  stats: Stats
  statsLoading: boolean
}

export function OrdersStats({ stats, statsLoading }: OrdersStatsProps) {
  const s = statsLoading
    ? { total: 0, booking: 0, confirmed: 0, inProgress: 0, completed: 0, cancelled: 0, belumLunas: 0, lunas: 0 }
    : stats

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
      <StatCard label="Total Order" value={s.total}      icon={ClipboardList} color="bg-primary/10 text-primary" />
      <StatCard label="Booking"     value={s.booking}    icon={Clock}         color="bg-blue-500/10 text-blue-500" />
      <StatCard label="Confirmed"   value={s.confirmed}  icon={CheckCircle}   color="bg-yellow-500/10 text-yellow-500" />
      <StatCard label="In Progress" value={s.inProgress} icon={Loader}        color="bg-orange-500/10 text-orange-500" />
      <StatCard label="Selesai"     value={s.completed}  icon={BadgeCheck}    color="bg-green-500/10 text-green-500" />
      <StatCard label="Batal"       value={s.cancelled}  icon={XCircle}       color="bg-destructive/10 text-destructive" />
      <StatCard label="Belum Lunas" value={s.belumLunas} icon={CreditCard}    color="bg-orange-500/10 text-orange-500" />
      <StatCard label="Lunas"       value={s.lunas}      icon={CheckCircle}   color="bg-green-500/10 text-green-500" />
    </div>
  )
}
