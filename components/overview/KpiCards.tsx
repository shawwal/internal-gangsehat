import { Users, TrendingUp, TrendingDown, DollarSign, Building2 } from 'lucide-react'
import { formatRp } from './utils'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  color: string
  sub?: string
}

function GlassStatCard({ title, value, icon, color, sub }: StatCardProps) {
  return (
    <div className="glass-card p-5 hover:scale-[1.02] transition-transform duration-200 cursor-default">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

interface KpiCardsProps {
  totalPatients: number
  totalStaff: number
  activeBranches: number
  totalIncome: number
  netProfit: number
}

export function KpiCards({ totalPatients, totalStaff, activeBranches, totalIncome, netProfit }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <GlassStatCard
        title="Total Pasien"
        value={totalPatients}
        icon={<Users size={16} className="text-white" />}
        color="bg-primary"
      />
      <GlassStatCard
        title="Staff Aktif"
        value={totalStaff}
        icon={<Users size={16} className="text-white" />}
        color="bg-[var(--chart-2)]"
      />
      <GlassStatCard
        title="Cabang Aktif"
        value={activeBranches}
        icon={<Building2 size={16} className="text-white" />}
        color="bg-[var(--chart-3)]"
      />
      <GlassStatCard
        title="Total Pemasukan"
        value={formatRp(totalIncome)}
        icon={<TrendingUp size={16} className="text-white" />}
        color="bg-[var(--chart-4)]"
        sub="Semua cabang dikonfirmasi"
      />
      <GlassStatCard
        title="Laba Bersih"
        value={formatRp(netProfit)}
        icon={netProfit >= 0
          ? <DollarSign size={16} className="text-white" />
          : <TrendingDown size={16} className="text-white" />}
        color={netProfit >= 0 ? 'bg-[var(--chart-4)]' : 'bg-destructive'}
        sub={netProfit >= 0 ? 'Untung' : 'Rugi'}
      />
    </div>
  )
}
