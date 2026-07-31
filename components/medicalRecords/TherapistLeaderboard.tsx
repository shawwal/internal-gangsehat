'use client'

import Link from 'next/link'
import { AlertTriangle, Bell, Building2, ChevronRight, Loader2, User } from 'lucide-react'
import type { TherapistRecordStat } from '@/app/actions/medicalRecords'
import { formatRecordDate } from './types'

interface Props {
  rows: TherapistRecordStat[]
  isDirector: boolean
  remindingIds: Set<string>
  remindedIds: Set<string>
  onRemind: (staffId: string) => void
}

function rateBadgeCls(rate: number) {
  if (rate < 70) return 'bg-destructive/15 text-destructive'
  if (rate < 90) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
  return 'bg-[#34C759]/15 text-[#34C759]'
}

export function TherapistLeaderboard({ rows, isDirector, remindingIds, remindedIds, onRemind }: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 px-4 bg-muted/30 rounded-3xl gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <User size={22} className="text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground">Belum ada data kunjungan pada periode ini</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const reminding = remindingIds.has(row.staff_id)
        const reminded  = remindedIds.has(row.staff_id)
        return (
          <div
            key={row.staff_id}
            className={`glass-card border-l-4 p-4 space-y-3 transition-all ${
              row.completionRate < 70 ? 'border-l-destructive' : row.completionRate < 90 ? 'border-l-amber-400' : 'border-l-[#34C759]'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-muted overflow-hidden">
                {row.avatar_url
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.avatar_url} alt={row.name} className="w-full h-full object-cover" />
                  : <User size={18} className="text-muted-foreground" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-foreground leading-tight">{row.name}</p>
                    {isDirector && row.branch_name && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Building2 size={11} /> {row.branch_name}
                      </span>
                    )}
                  </div>
                  <span className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${rateBadgeCls(row.completionRate)}`}>
                    {row.completionRate < 70 && <AlertTriangle size={11} />}
                    {row.completionRate}% lengkap
                  </span>
                </div>

                <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>{row.total} kunjungan</span>
                  <span className="text-[#34C759]">{row.complete} lengkap</span>
                  <span className={row.incomplete > 0 ? 'text-amber-600 dark:text-amber-400' : ''}>
                    {row.incomplete} belum lengkap
                  </span>
                  {row.oldestIncompleteDate && (
                    <span>Tertunda sejak {formatRecordDate(row.oldestIncompleteDate)}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1 border-t border-border/40">
              <Link
                href={`/medical-records?staffId=${row.staff_id}&completeness=incomplete`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
              >
                Lihat Detail <ChevronRight size={14} />
              </Link>

              {row.incomplete > 0 && (
                <button
                  type="button"
                  onClick={() => onRemind(row.staff_id)}
                  disabled={reminding || reminded}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 text-sm font-medium hover:bg-amber-500/25 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {reminding ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                  {reminded ? 'Terkirim' : 'Ingatkan'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
