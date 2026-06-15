import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { STATUS_BADGE, STATUS_LABEL } from './constants'

interface Visit {
  id: string
  visit_date: string
  service_type: string | null
  status: string
  chief_complaint: string | null
  shift: string | null
  kehadiran: string | null
  internal_profiles: { full_name: string } | null
}

interface PatientVisitHistoryProps {
  visits: Visit[]
  totalVisits: number
  patientId: string
}

export function PatientVisitHistory({ visits, totalVisits, patientId }: PatientVisitHistoryProps) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="text-primary"><ClipboardList size={15} /></span>
          Riwayat Kunjungan
          {totalVisits > 0 && (
            <span className="text-xs font-normal text-muted-foreground ml-1">
              ({totalVisits} total)
            </span>
          )}
        </h2>
        <Link
          href={`/patients/${patientId}/visits`}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors duration-150 cursor-pointer"
        >
          <ClipboardList size={12} /> Lihat Semua
        </Link>
      </div>

      {!visits.length ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Belum ada kunjungan.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Riwayat kunjungan">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4">Tanggal</th>
                <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4 hidden sm:table-cell">Layanan</th>
                <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4 hidden md:table-cell">Terapis</th>
                <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4 hidden md:table-cell">Kehadiran</th>
                <th className="text-left text-xs font-medium text-muted-foreground pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v, i) => (
                <tr
                  key={v.id}
                  className={i !== visits.length - 1 ? 'border-b border-border/40' : ''}
                >
                  <td className="py-2.5 pr-4">
                    <p className="text-sm font-medium text-foreground">{v.visit_date}</p>
                    {v.shift ? (
                      <p className="text-xs text-muted-foreground">{v.shift}</p>
                    ) : v.chief_complaint ? (
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">{v.chief_complaint}</p>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-4 hidden sm:table-cell">
                    <span className="text-xs text-muted-foreground">{v.service_type ?? '—'}</span>
                  </td>
                  <td className="py-2.5 pr-4 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground">
                      {v.internal_profiles?.full_name ?? '—'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 hidden md:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      v.kehadiran === 'HADIR'
                        ? 'bg-chart-4/15 text-chart-4'
                        : v.kehadiran === 'TIDAK HADIR'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {v.kehadiran ?? '—'}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      STATUS_BADGE[v.status] ?? 'bg-muted text-muted-foreground'
                    }`}>
                      {STATUS_LABEL[v.status] ?? v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
