import Link from 'next/link'
import { FilePen, Phone, MessageCircle, ChevronRight } from 'lucide-react'
import type { MyStudent } from '@/app/actions/griyaMyStudents'
import { DISCIPLINE_COLOR, DISCIPLINE_LABEL, HARI_LABEL } from '@/components/griya/constants'
import { GENDER_LABEL, calcAge } from '@/components/patients/detail/constants'
import { formatWaNumber } from '@/lib/utils'
import { STATUS_CLS, STATUS_LABEL, fmtDate, relDays } from './constants'
import type { PeriodStats } from './period'

export function StudentCard({ s, today, period, periodLabel, showTotal }: {
  s: MyStudent; today: string; period: PeriodStats; periodLabel: string; showTotal: boolean
}) {
  const age = calcAge(s.birthDate)
  const meta = [s.gender ? GENDER_LABEL[s.gender as keyof typeof GENDER_LABEL] : null, age !== '—' ? age : null].filter(Boolean).join(' · ')
  const wa = s.phone ? formatWaNumber(s.phone) : ''

  return (
    <div className={`glass-card p-4 flex flex-col gap-3 ${s.status === 'inactive' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/griya-anak/siswa/${s.patientId}`} className="min-w-0 group">
          <p className="font-semibold text-foreground truncate group-hover:text-primary">{s.name}</p>
          <p className="text-xs text-muted-foreground truncate">{meta || '—'}</p>
        </Link>
        <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${STATUS_CLS[s.status]}`}>{STATUS_LABEL[s.status]}</span>
      </div>

      {s.keluhan && <p className="text-xs text-muted-foreground line-clamp-2">{s.keluhan}</p>}

      {(s.disciplines.length > 0 || s.slots.length > 0) && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            {s.disciplines.map((d) => (
              <span key={d} className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${DISCIPLINE_COLOR[d].tint}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${DISCIPLINE_COLOR[d].dot}`} />{DISCIPLINE_LABEL[d]}
              </span>
            ))}
          </div>
          {s.slots.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Jadwal rutin: {s.slots.map((sl) => `${HARI_LABEL[sl.hari]} ${sl.time}`).join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label={periodLabel} value={period.sessions} highlight />
        {showTotal
          ? <Metric label="Total sesi" value={s.sessionsTotal} />
          : <Metric label="Bulan ini" value={s.sessionsMonth} />}
        <Metric label="Tidak hadir" value={period.missed} warn={period.missed > 0} />
      </div>

      <dl className="text-xs space-y-1">
        <Row label="Terakhir hadir" value={s.lastVisit ? `${fmtDate(s.lastVisit)} (${relDays(s.lastVisit, today)})` : 'Belum pernah'} />
        <Row label="Sesi berikutnya"
          value={s.nextVisit ? `${fmtDate(s.nextVisit)}${s.nextVisitTime ? ` · ${s.nextVisitTime}` : ''} (${relDays(s.nextVisit, today)})` : 'Belum ada'} />
        <Row label="Mulai ditangani" value={fmtDate(s.firstVisit)} />
      </dl>

      {s.pendingRecords > 0 && s.pendingHref && (
        <Link href={s.pendingHref}
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#FFB35C]/15 text-[#FFB35C] text-xs font-medium hover:bg-[#FFB35C]/25 transition-colors">
          <span className="flex items-center gap-1.5"><FilePen size={13} /> {s.pendingRecords} rekam medis belum selesai</span>
          <ChevronRight size={14} />
        </Link>
      )}

      <div className="flex items-center gap-2 mt-auto pt-1">
        <Link href={`/griya-anak/siswa/${s.patientId}`}
          className="flex-1 text-center py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors">
          Detail siswa
        </Link>
        {s.phone && (
          <>
            <a href={`tel:${s.phone}`} aria-label={`Telepon orang tua ${s.name}`}
              className="p-2 rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors"><Phone size={14} /></a>
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp orang tua ${s.name}`}
              className="p-2 rounded-xl border border-border text-[#34C759] hover:bg-muted transition-colors"><MessageCircle size={14} /></a>
          </>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, warn, highlight }: { label: string; value: number; warn?: boolean; highlight?: boolean }) {
  return (
    <div className={`rounded-xl py-2 ${highlight ? 'bg-primary/10' : 'bg-muted/50'}`}>
      <p className={`text-lg font-bold leading-none ${warn ? 'text-destructive' : highlight ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1 truncate px-1">{label}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-foreground text-right">{value}</dd>
    </div>
  )
}
