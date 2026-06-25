'use client'

import { useState } from 'react'
import { Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { fetchPackageSessions } from '@/app/actions/packages'
import { SessionList } from './SessionList'
import {
  OP_STATUS_BADGE, STATUS_BADGE, STATUS_LABEL, COMPLETION_BADGE, COMPLETION_LABEL,
} from './types'
import { formatDate, sessionBarColor, sessionTextColor } from './helpers'
import type { PatientPackage, PackageSession } from './types'

interface PackageCardProps {
  pkg:      PatientPackage
  onEdit:   (pkg: PatientPackage) => void
  onDelete: (id: string) => void
}

export function PackageCard({ pkg, onEdit, onDelete }: PackageCardProps) {
  const pct = pkg.total_sessions > 0 ? (pkg.used_sessions / pkg.total_sessions) * 100 : 0
  const [expanded, setExpanded]             = useState(false)
  const [sessions, setSessions]             = useState<PackageSession[] | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(false)

  async function toggleSessions() {
    if (!expanded && sessions === null) {
      setLoadingSessions(true)
      const data = await fetchPackageSessions(pkg.id)
      setSessions(data)
      setLoadingSessions(false)
    }
    setExpanded((v) => !v)
  }

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground truncate">{pkg.package_name}</span>
            {pkg.jenis_paket && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                {pkg.jenis_paket}
              </span>
            )}
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${OP_STATUS_BADGE[pkg.operational_status]}`}>
              {pkg.operational_status}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_BADGE[pkg.status]}`}>
              {STATUS_LABEL[pkg.status]}
            </span>
            {pkg.mulai_paket && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border font-medium">
                {pkg.mulai_paket}
              </span>
            )}
            {pkg.completion_status && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${COMPLETION_BADGE[pkg.completion_status]}`}>
                {COMPLETION_LABEL[pkg.completion_status]}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(pkg)}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          {pkg.status === 'active' && (
            <button
              onClick={() => onDelete(pkg.id)}
              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Batalkan"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Session progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{pkg.used_sessions} dari {pkg.total_sessions} sesi digunakan</span>
          <span className={`font-semibold ${sessionTextColor(pkg.remaining_sessions)}`}>
            {pkg.remaining_sessions} sesi tersisa
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${sessionBarColor(pkg.remaining_sessions, pkg.total_sessions)}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      {/* Session drill-down toggle */}
      <button
        onClick={toggleSessions}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors text-xs text-muted-foreground"
      >
        <span>Sesi Terpakai ({pkg.used_sessions})</span>
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {expanded && (
        <div className="rounded-xl border border-border overflow-hidden">
          <SessionList sessions={sessions} loading={loadingSessions} />
        </div>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        {pkg.notes
          ? <p className="text-xs text-muted-foreground truncate max-w-[60%]">{pkg.notes}</p>
          : <span />
        }
        <p className="text-[10px] text-muted-foreground/60 shrink-0">{formatDate(pkg.created_at)}</p>
      </div>
    </div>
  )
}
