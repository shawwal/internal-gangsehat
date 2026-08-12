import { Users, PackageCheck, Activity, UserPlus } from 'lucide-react'
import type { HomeVisitStatsData } from './types'

function StatCard({ label, value, icon: Icon, color, loading }: {
  label: string; value: number; icon: React.ElementType; color: string; loading?: boolean
}) {
  return (
    <div className="glass-card p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        {loading
          ? <div className="h-6 w-10 bg-muted animate-pulse rounded mt-0.5" />
          : <p className="text-xl font-bold text-foreground leading-tight">{value.toLocaleString('id-ID')}</p>
        }
      </div>
    </div>
  )
}

export function HomeVisitStats({ stats, loading }: { stats: HomeVisitStatsData; loading: boolean }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard label="Pasien Home Visit" value={stats.totalPatients}  icon={Users}       color="bg-primary/10 text-primary"      loading={loading} />
      <StatCard label="Paket Aktif"       value={stats.activePackages} icon={PackageCheck} color="bg-[#34C759]/10 text-[#34C759]"  loading={loading} />
      <StatCard label="Kunjungan Bulan Ini" value={stats.visitsThisMonth} icon={Activity}  color="bg-blue-500/10 text-blue-400"    loading={loading} />
      <StatCard label="Belum Beli Paket"  value={stats.noPackageYet}   icon={UserPlus}     color="bg-[#FFB35C]/10 text-[#FFB35C]"  loading={loading} />
    </div>
  )
}
