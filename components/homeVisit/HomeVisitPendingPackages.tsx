import Link from 'next/link'
import { Package } from 'lucide-react'
import type { HomeVisitPendingPackageRow } from './types'

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Props {
  rows: HomeVisitPendingPackageRow[]
  showBranch: boolean
}

/** Bought PAKET VISIT packages that have no session yet — they never show in the session log. */
export function HomeVisitPendingPackages({ rows, showBranch }: Props) {
  if (rows.length === 0) return null
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[#FFB35C]/10 text-[#FFB35C] flex items-center justify-center shrink-0">
          <Package size={14} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Paket belum ada sesi ({rows.length})</p>
          <p className="text-xs text-muted-foreground">Paket home visit sudah dibeli, sesi pertama belum dicatat</p>
        </div>
      </div>
      <div className="divide-y divide-border/50">
        {rows.map((row) => (
          <div key={row.package_id} className="flex items-center justify-between gap-3 py-2 flex-wrap">
            <div className="min-w-0">
              <Link href={`/patients/${row.patient_id}/packages`} className="text-sm font-medium text-primary hover:underline">
                {row.patient_name}
              </Link>
              {row.no_rm && <span className="ml-2 text-[10px] text-muted-foreground/70 font-mono">{row.no_rm}</span>}
              <p className="text-xs text-muted-foreground truncate">
                {row.package_name} · 0/{row.total_sessions} sesi
                {showBranch && row.branch_name ? ` · ${row.branch_name}` : ''}
              </p>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">Dibeli {formatDate(row.purchased_at)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
