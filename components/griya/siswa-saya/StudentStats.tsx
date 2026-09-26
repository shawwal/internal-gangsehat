import { Users, CalendarCheck, CalendarClock, FilePen, UserX } from 'lucide-react'

export interface StudentStatsData {
  active: number; total: number; inPeriod: number; sessions: number; missed: number; pending: number; scheduled: number
}

export function StudentStats({ data, periodAll, onPendingClick }: {
  data: StudentStatsData; periodAll: boolean; onPendingClick?: () => void
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {periodAll
        ? <StatCard icon={Users} label="Siswa aktif" value={data.active} sub={`${data.total} total ditangani`} />
        : <StatCard icon={Users} label="Siswa di periode" value={data.inPeriod} sub={`${data.active} aktif · ${data.total} total`} />}
      <StatCard icon={CalendarCheck} label="Sesi hadir" value={data.sessions}
        sub={data.missed > 0 ? `${data.missed} tidak hadir` : 'kehadiran tercatat'} />
      <StatCard icon={FilePen} label="Rekam medis belum" value={data.pending} sub="perlu diselesaikan"
        tone={data.pending > 0 ? 'warn' : undefined} onClick={data.pending > 0 ? onPendingClick : undefined} />
      <StatCard icon={CalendarClock} label="Terjadwal" value={data.scheduled} sub="punya sesi mendatang" />
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, tone, onClick }: {
  icon: typeof UserX; label: string; value: number; sub: string; tone?: 'warn'; onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick}
      className={`glass-card p-3.5 text-left ${onClick ? 'cursor-pointer hover:bg-muted/40 transition-colors' : ''}`}>
      <div className={`flex items-center gap-1.5 text-xs ${tone === 'warn' ? 'text-[#FFB35C]' : 'text-muted-foreground'}`}>
        <Icon size={13} /> {label}
      </div>
      <p className={`text-2xl font-bold mt-1 ${tone === 'warn' ? 'text-[#FFB35C]' : 'text-foreground'}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
    </Tag>
  )
}
