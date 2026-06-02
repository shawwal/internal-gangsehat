'use client'

import { Users, FileEdit, CheckCircle2, CreditCard } from 'lucide-react'
import type { PayrollStats } from './types'

function StatCard({
  icon: Icon,
  label,
  value,
  colorClass,
}: {
  icon: React.ElementType
  label: string
  value: number
  colorClass: string
}) {
  return (
    <div className="glass-card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground">{value.toLocaleString('id-ID')}</p>
      </div>
    </div>
  )
}

export function PayrollStats({ total, draft, confirmed, paid }: PayrollStats) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard icon={Users}        label="Total Karyawan"  value={total}     colorClass="bg-primary/10 text-primary" />
      <StatCard icon={FileEdit}     label="Draft"           value={draft}     colorClass="bg-muted text-muted-foreground" />
      <StatCard icon={CheckCircle2} label="Dikonfirmasi"    value={confirmed} colorClass="bg-secondary/20 text-secondary-foreground" />
      <StatCard icon={CreditCard}   label="Dibayar"         value={paid}      colorClass="bg-chart-4/15 text-chart-4" />
    </div>
  )
}
