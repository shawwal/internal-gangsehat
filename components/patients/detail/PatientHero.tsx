import { Clock, Droplets, Hash, MessageSquareWarning } from 'lucide-react'
import type { PatientPlain } from '@/app/actions/patients'
import { GENDER_LABEL, AVATAR_BG, calcAge, formatDateTime, getInitials } from './constants'
import { PatientEditButton } from './PatientEditButton'

interface PatientHeroProps {
  patient: PatientPlain
  totalVisits: number
  canEdit: boolean
  latestComplaint?: string | null
}

export function PatientHero({ patient, totalVisits, canEdit, latestComplaint }: PatientHeroProps) {
  const avatarBg = AVATAR_BG[patient.gender ?? 'other']

  return (
    <div className="glass-card p-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Avatar */}
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 ${avatarBg}`}>
          {getInitials(patient.name)}
        </div>

        {/* Name + key facts */}
        <div className="min-w-0 space-y-2 sm:max-w-[40%]">
          <div>
            <p className="text-lg font-bold text-foreground">{patient.name}</p>
            <p className="text-sm text-muted-foreground">
              {patient.gender ? GENDER_LABEL[patient.gender] : '—'}
              {patient.birthDate && ` · ${calcAge(patient.birthDate)}`}
            </p>
          </div>

          {/* Quick badge row */}
          <div className="flex flex-wrap gap-2">
            {patient.no_rm && (
              <span className="flex items-center gap-1 text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded-md">
                <Hash size={10} /> {patient.no_rm}
              </span>
            )}
            {patient.blood_type && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-destructive/10 text-destructive">
                <Droplets size={10} /> {patient.blood_type}
              </span>
            )}
            {patient.agama && (
              <span className="text-xs bg-secondary/15 text-secondary-foreground px-2 py-0.5 rounded-md">
                {patient.agama}
              </span>
            )}
            {patient.pekerjaan && (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-md">
                {patient.pekerjaan}
              </span>
            )}
          </div>
        </div>

        {/* Latest complaint — TA first, then any visit, then patient's own input */}
        <div className="flex-1 w-full min-w-0 rounded-2xl border border-[#FFB35C]/30 bg-[#FFB35C]/10 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#FFB35C]">
            <MessageSquareWarning size={12} /> Keluhan Terakhir
          </p>
          <p className="mt-1 text-sm text-foreground line-clamp-3" title={latestComplaint ?? undefined}>
            {latestComplaint || '—'}
          </p>
        </div>

        {/* Right: visit count + edit button */}
        <div className="flex flex-row sm:flex-col items-center gap-3 shrink-0">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground leading-none">{totalVisits}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Kunjungan</p>
          </div>
          {canEdit && <PatientEditButton patientId={patient.id} />}
        </div>
      </div>

      {/* Meta timestamps */}
      <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border/50">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock size={11} /> Daftar: {formatDateTime(patient.createdAt)}
        </span>
        {patient.updatedAt && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={11} /> Update: {formatDateTime(patient.updatedAt)}
          </span>
        )}
      </div>
    </div>
  )
}
