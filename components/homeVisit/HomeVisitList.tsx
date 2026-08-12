import Link from 'next/link'
import { CalendarPlus, PackagePlus, FileText, MapPinned } from 'lucide-react'
import type { HomeVisitPatientRow } from './types'

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const SERVICE_BADGE: Record<string, string> = {
  'TA VISIT':    'bg-primary/10 text-primary border-primary/15',
  'SESI VISIT':  'bg-muted/40 text-muted-foreground border-border',
  'PAKET VISIT': 'bg-chart-4/10 text-chart-4 border-chart-4/15',
}

function packageBadge(pkg: HomeVisitPatientRow['package']) {
  if (!pkg) return <span className="text-xs text-muted-foreground/60">Belum beli paket</span>
  const statusCls = pkg.payment_status === 'LUNAS'
    ? 'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/20'
    : 'bg-[#FFB35C]/15 text-[#FFB35C] border-[#FFB35C]/20'
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-foreground/80">
        {pkg.jenis_paket ?? '—'} · {pkg.used_sessions}/{pkg.total_sessions} sesi
      </span>
      {pkg.payment_status && (
        <span className={`inline-block w-fit text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${statusCls}`}>
          {pkg.payment_status}{pkg.outstanding > 0 && ` · Sisa Rp${pkg.outstanding.toLocaleString('id-ID')}`}
        </span>
      )}
    </div>
  )
}

interface Props {
  rows: HomeVisitPatientRow[]
  loading: boolean
  showBranch: boolean
  onRecordVisit: (row: HomeVisitPatientRow) => void
  onBuyPackage: (row: HomeVisitPatientRow) => void
}

export function HomeVisitList({ rows, loading, showBranch, onRecordVisit, onBuyPackage }: Props) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pasien</th>
              {showBranch && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cabang</th>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kunjungan Terakhir</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Paket</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: showBranch ? 5 : 4 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded-lg" /></td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={showBranch ? 5 : 4} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <MapPinned size={22} className="text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Belum ada pasien home visit</p>
                    <p className="text-xs text-muted-foreground">Tekan &quot;Catat Kunjungan&quot; untuk mulai mencatat kunjungan home visit</p>
                  </div>
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.patient_id} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{row.patient_name}</p>
                  {row.no_rm && <p className="text-[10px] text-muted-foreground/70 font-mono">{row.no_rm}</p>}
                </td>
                {showBranch && (
                  <td className="px-4 py-3"><span className="text-xs text-foreground/80">{row.branch_name || '—'}</span></td>
                )}
                <td className="px-4 py-3">
                  <p className="text-sm text-foreground">{formatDate(row.last_visit_date)}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {row.last_service_type && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${SERVICE_BADGE[row.last_service_type] ?? ''}`}>
                        {row.last_service_type}
                      </span>
                    )}
                    {row.last_kehadiran && (
                      <span className="text-[10px] text-muted-foreground">{row.last_kehadiran}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">{packageBadge(row.package)}</td>
                <td className="px-4 py-3 text-center">
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={() => onRecordVisit(row)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-foreground/70 hover:bg-muted transition-colors"
                      title="Catat kunjungan"
                    >
                      <CalendarPlus size={12} /> Kunjungan
                    </button>
                    <button
                      onClick={() => onBuyPackage(row)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                      title="Beli paket home visit"
                    >
                      <PackagePlus size={12} /> Paket
                    </button>
                    <Link
                      href={`/patients/${row.patient_id}/visits`}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                      title="Rekam medis lengkap"
                    >
                      <FileText size={12} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
