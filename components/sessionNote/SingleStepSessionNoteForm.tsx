'use client'

import { AlertTriangle, Loader2 } from 'lucide-react'
import { SectionSubjective } from './SectionSubjective'
import { SectionObjective } from './SectionObjective'
import { SectionAssessment } from './SectionAssessment'
import { SectionPlan } from './SectionPlan'
import type { SessionNoteFormState } from './types'

interface Props {
  form: SessionNoteFormState
  patchForm: (patch: Partial<SessionNoteFormState>) => void
  error: string | null
  saving: boolean
  onSubmit: () => void
  readOnly?: boolean
}

export function SingleStepSessionNoteForm({ form, patchForm, error, saving, onSubmit, readOnly }: Props) {
  return (
    <div className="glass-card p-4 sm:p-6 space-y-6">
      <SectionSubjective value={form} onChange={patchForm} readOnly={readOnly} />
      <SectionObjective value={form} onChange={patchForm} readOnly={readOnly} />
      <SectionAssessment value={form} onChange={patchForm} readOnly={readOnly} />
      <SectionPlan value={form} onChange={patchForm} readOnly={readOnly} />

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <AlertTriangle size={12} /> {error}
        </p>
      )}

      <div className="flex sm:justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="w-full sm:w-auto min-h-11 px-5 py-2.5 sm:py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          Simpan Catatan Perawatan
        </button>
      </div>
    </div>
  )
}
