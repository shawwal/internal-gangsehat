'use client'

import Link from 'next/link'
import { Bell, Building2, Calendar, CheckCircle2, ChevronRight, Loader2, User, AlertTriangle } from 'lucide-react'
import { getVisitFormRoute } from '@/lib/visitRouting'
import type { MedicalRecordRow } from '@/app/actions/medicalRecords'
import { formatRecordDate } from './types'

interface Props {
  record: MedicalRecordRow
  isTeamView: boolean
  onOpenQuickForm: (visitId: string) => void
  onRemind?: (visitId: string) => void
  reminding?: boolean
  reminded?: boolean
}

function missingFieldsLabel(record: MedicalRecordRow): string {
  const missing: string[] = []
  if (!record.diagnosis) missing.push('diagnosis')
  if (!record.treatment) missing.push('tindakan')
  if (!record.regio)     missing.push('regio')
  return missing.join(', ')
}

export function MedicalRecordCard({ record, isTeamView, onOpenQuickForm, onRemind, reminding, reminded }: Props) {
  const formRoute = getVisitFormRoute(record.service_type)
  const fillHref = formRoute ? `/visits/${record.id}/${formRoute}?from=/medical-records` : null

  return (
    <div className={`glass-card border-l-4 p-4 space-y-3 transition-all ${
      record.is_complete ? 'border-l-[#34C759]' : 'border-l-amber-400'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          record.is_complete ? 'bg-[#34C759]/15' : 'bg-amber-500/15'
        }`}>
          <User size={18} className={record.is_complete ? 'text-[#34C759]' : 'text-amber-500'} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">{record.patient_name}</p>
              {record.service_type && (
                <p className="text-xs text-muted-foreground">{record.service_type}</p>
              )}
            </div>
            <span className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0 ${
              record.is_complete ? 'bg-[#34C759]/15 text-[#34C759]' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            }`}>
              {record.is_complete ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
              {record.is_complete ? 'Lengkap' : 'Belum Lengkap'}
            </span>
          </div>

          <div className="flex flex-wrap gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar size={11} />
              {formatRecordDate(record.visit_date)}{record.visit_time ? ` · ${record.visit_time}` : ''}
            </span>
            {isTeamView && (
              <>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User size={11} /> {record.attending_staff_name}
                </span>
                {record.branch_name && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 size={11} /> {record.branch_name}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {!record.is_complete && (
        <p className="text-xs text-amber-600 dark:text-amber-400 pl-0">
          Kurang: <span className="font-medium">{missingFieldsLabel(record)}</span>
        </p>
      )}

      <div className="flex gap-2 pt-1 border-t border-border/40">
        {fillHref ? (
          <Link
            href={fillHref}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
          >
            {record.is_complete ? 'Lihat / Edit' : 'Lengkapi Sekarang'} <ChevronRight size={14} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => onOpenQuickForm(record.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
          >
            {record.is_complete ? 'Lihat / Edit' : 'Lengkapi Sekarang'} <ChevronRight size={14} />
          </button>
        )}

        {isTeamView && !record.is_complete && onRemind && (
          <button
            type="button"
            onClick={() => onRemind(record.id)}
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
}
