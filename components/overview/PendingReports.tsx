import Link from 'next/link'
import { Building2, TrendingUp } from 'lucide-react'
import { MONTH_NAMES } from './utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PendingReport = any

interface PendingReportsProps {
  pendingReports: PendingReport[]
}

export function PendingReports({ pendingReports }: PendingReportsProps) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Laporan Menunggu Persetujuan</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Laporan bulanan yang perlu ditinjau</p>
        </div>
        {pendingReports.length > 0 && (
          <Link href="/director/reports" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
            Lihat semua →
          </Link>
        )}
      </div>

      {pendingReports.length === 0 ? (
        <div className="flex items-center gap-3 py-6 px-4 bg-muted/30 rounded-2xl">
          <div className="w-8 h-8 rounded-2xl bg-chart-4/15 flex items-center justify-center shrink-0">
            <TrendingUp size={16} className="text-chart-4" style={{ color: 'var(--chart-4)' }} />
          </div>
          <p className="text-sm text-muted-foreground">Semua laporan sudah ditinjau. Tidak ada yang menunggu.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pendingReports.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-3 px-4 bg-muted/20 rounded-2xl hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl bg-secondary/20 flex items-center justify-center shrink-0">
                  <Building2 size={14} className="text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{r.branches?.name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {MONTH_NAMES[(r.period_month ?? 1) - 1]} {r.period_year}
                  </p>
                </div>
              </div>
              <Link
                href="/director/reports"
                className="text-xs font-medium px-3 py-1.5 rounded-xl bg-secondary/20 text-secondary-foreground hover:bg-secondary/30 transition-colors"
              >
                Tinjau
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
