import Link from 'next/link'
import { Users, TrendingUp, TrendingDown, Activity, Package } from 'lucide-react'
import { formatRp } from './utils'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  color: string
  sub?: string
  href?: string
}

function GlassStatCard({ title, value, icon, color, sub, href }: StatCardProps) {
  const inner = (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </>
  )

  if (href) {
    return (
      <Link href={href} className="glass-card p-5 hover:scale-[1.02] hover:ring-1 hover:ring-primary/30 transition-all duration-200 cursor-pointer block">
        {inner}
      </Link>
    )
  }

  return (
    <div className="glass-card p-5 hover:scale-[1.02] transition-transform duration-200 cursor-default">
      {inner}
    </div>
  )
}

interface KpiCardsProps {
  totalPatients: number
  totalStaff: number
  visits: number
  activePackages: number
  totalIncome: number
  totalExpense: number
  periodLabel: string
}

export function KpiCards({
  totalPatients,
  totalStaff,
  visits,
  activePackages,
  totalIncome,
  totalExpense,
  periodLabel,
}: KpiCardsProps) {
  const netProfit = totalIncome - totalExpense

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <GlassStatCard
        title="Total Pasien"
        value={totalPatients.toLocaleString('id-ID')}
        icon={<Users size={16} className="text-white" />}
        color="bg-primary"
        href="/patients"
        sub="Lihat semua →"
      />
      <GlassStatCard
        title="Staff Aktif"
        value={totalStaff}
        icon={<Users size={16} className="text-white" />}
        color="bg-[var(--chart-2)]"
        sub="Eksklusif staff biasa"
      />
      <GlassStatCard
        title="Kunjungan"
        value={visits.toLocaleString('id-ID')}
        icon={<Activity size={16} className="text-white" />}
        color="bg-[var(--chart-3)]"
        sub={periodLabel}
      />
      <GlassStatCard
        title="Paket Aktif"
        value={activePackages.toLocaleString('id-ID')}
        icon={<Package size={16} className="text-white" />}
        color="bg-[var(--chart-1)]"
        sub="Status aktif"
      />
      <GlassStatCard
        title="Pemasukan"
        value={formatRp(totalIncome)}
        icon={<TrendingUp size={16} className="text-white" />}
        color="bg-[var(--chart-4)]"
        sub="Lihat per cabang →"
        href="/director/finance"
      />
      <GlassStatCard
        title={netProfit >= 0 ? 'Laba Bersih' : 'Rugi Bersih'}
        value={formatRp(Math.abs(netProfit))}
        icon={netProfit >= 0
          ? <TrendingUp size={16} className="text-white" />
          : <TrendingDown size={16} className="text-white" />}
        color={netProfit >= 0 ? 'bg-green-500' : 'bg-destructive'}
        sub={`Keluar ${formatRp(totalExpense)}`}
      />
    </div>
  )
}
