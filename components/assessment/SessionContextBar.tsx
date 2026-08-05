'use client'

import Link from 'next/link'
import { History, Package, ExternalLink } from 'lucide-react'

interface Props {
  sessionNumber: number
  totalSessions: number | null
  isPackage: boolean
  /** Diagnosis pulled forward from the patient's latest completed TA — omit to hide that part. */
  priorDiagnosis?: string | null
  /** visit_id of the TA the diagnosis came from — lets the therapist jump straight to it. */
  priorAssessmentVisitId?: string | null
}

export function SessionContextBar({ sessionNumber, totalSessions, isPackage, priorDiagnosis, priorAssessmentVisitId }: Props) {
  return (
    <div className="glass-card p-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 bg-primary/5 border-primary/20">
      <div className="flex items-center gap-1.5 shrink-0">
        <History size={13} className="text-primary" />
        <span className="text-xs font-semibold text-foreground whitespace-nowrap">
          Pertemuan ke-{sessionNumber}{isPackage && totalSessions ? ` dari ${totalSessions}` : ''}
        </span>
      </div>

      <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground font-medium shrink-0">
        <Package size={10} />
        {isPackage ? 'Paket' : 'Sesi Mandiri'}
      </span>

      {priorDiagnosis && (
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground shrink-0">Diagnosis Terakhir:</span>
          <span className="text-xs text-foreground truncate">{priorDiagnosis}</span>
        </div>
      )}

      {priorAssessmentVisitId && (
        <Link
          href={`/visits/${priorAssessmentVisitId}/assessment`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline shrink-0 ml-auto"
        >
          Lihat TA Terakhir <ExternalLink size={10} />
        </Link>
      )}
    </div>
  )
}
