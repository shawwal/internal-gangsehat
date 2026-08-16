import Link from 'next/link'
import { MapPinned } from 'lucide-react'
import type { HomeVisitSessionRow } from './types'

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const SERVICE_BADGE: Record<string, string> = {
  'TA VISIT':    'bg-primary/10 text-primary border-primary/15',
  'SESI VISIT':  'bg-muted/40 text-muted-foreground border-border',
  'PAKET VISIT': 'bg-chart-4/10 text-chart-4 border-chart-4/15',
}

const PAYMENT_BADGE: Record<string, string> = {
  LUNAS:     'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/20',
  DP:        'bg-[#FFB35C]/15 text-[#FFB35C] border-[#FFB35C]/20',
  PELUNASAN: 'bg-[#FFB35C]/15 text-[#FFB35C] border-[#FFB35C]/20',
}

function ServiceCell({ row }: { row: HomeVisitSessionRow }) {
  const label = row.service_type ?? '—'
  const pkg = row.package
  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-block w-fit text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${SERVICE_BADGE[label] ?? ''}`}>
        {label}
      </span>
      {pkg && pkg.total_sessions > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, (pkg.used_sessions / pkg.total_sessions) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">
            {pkg.jenis_paket ? `${pkg.jenis_paket} · ` : ''}{pkg.used_sessions}/{pkg.total_sessions}
          </span>
        </div>
      )}
    </div>
  )
}

function PaymentCell({ row }: { row: HomeVisitSessionRow }) {
  if (row.package) {
    return <span className="text-[10px] text-muted-foreground/70">Termasuk paket</span>
  }
  if (!row.has_payment) {
    return <span className="text-xs text-muted-foreground/60">Belum dibayar</span>
  }
  const status = row.payment_status ?? 'DP'
  return (
    <span className={`inline-block w-fit text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${PAYMENT_BADGE[status] ?? ''}`}>
      {status}{row.payment_outstanding > 0 && ` · Sisa Rp${row.payment_outstanding.toLocaleString('id-ID')}`}
    </span>
  )
}

interface Props {
  rows: HomeVisitSessionRow[]
  loading: boolean
  showBranch: boolean
}

export function HomeVisitSessionLog({ rows, loading, showBranch }: Props) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tanggal Kunjungan</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nama Pasien</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alamat</th>
              {showBranch && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cabang</th>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Layanan</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fisioterapis</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status Bayar</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: showBranch ? 7 : 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded-lg" /></td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={showBranch ? 7 : 6} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <MapPinned size={22} className="text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Belum ada sesi home visit</p>
                    <p className="text-xs text-muted-foreground">Tekan &quot;+ New Session&quot; untuk mulai mencatat kunjungan home visit</p>
                  </div>
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-foreground/80">{formatDate(row.visit_date)}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/patients/${row.patient_id}/visits`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {row.patient_name}
                  </Link>
                  {row.no_rm && <p className="text-[10px] text-muted-foreground/70 font-mono">{row.no_rm}</p>}
                </td>
                <td className="px-4 py-3 max-w-[220px] truncate text-xs text-muted-foreground" title={row.patient_address ?? ''}>
                  {row.patient_address || '—'}
                </td>
                {showBranch && (
                  <td className="px-4 py-3"><span className="text-xs text-foreground/80">{row.branch_name || '—'}</span></td>
                )}
                <td className="px-4 py-3"><ServiceCell row={row} /></td>
                <td className="px-4 py-3 text-xs text-foreground/80">{row.attending_staff_name ?? '—'}</td>
                <td className="px-4 py-3"><PaymentCell row={row} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
