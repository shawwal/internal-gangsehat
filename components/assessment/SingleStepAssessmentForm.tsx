'use client'

import { AlertTriangle, Loader2 } from 'lucide-react'
import { StepInterview } from './StepInterview'
import { StepPhysicalExam } from './StepPhysicalExam'
import { StepNeuroScreening } from './StepNeuroScreening'
import { StepOutcomeMeasures } from './StepOutcomeMeasures'
import { StepClinicalReasoning } from './StepClinicalReasoning'
import { StepPlanOfCare } from './StepPlanOfCare'
import { STEP_LABELS } from './types'
import type { AssessmentFormState } from './types'

interface Props {
  form: AssessmentFormState
  patchForm: (patch: Partial<AssessmentFormState>) => void
  error: string | null
  saving: boolean
  completing: boolean
  onSaveDraft: () => void
  onComplete: () => void
}

const SECTIONS = [
  StepInterview, StepPhysicalExam, StepNeuroScreening,
  StepOutcomeMeasures, StepClinicalReasoning, StepPlanOfCare,
]

export function SingleStepAssessmentForm({ form, patchForm, error, saving, completing, onSaveDraft, onComplete }: Props) {
  return (
    <div className="glass-card p-4 sm:p-6 space-y-6">
      {SECTIONS.map((Section, i) => (
        <div key={STEP_LABELS[i]} className="space-y-4">
          <div className="flex items-center gap-2 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-muted/40 border-y border-border">
            <h3 className="text-sm font-semibold text-foreground">{i + 1}. {STEP_LABELS[i]}</h3>
          </div>
          <Section value={form} onChange={patchForm} />
        </div>
      ))}

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <AlertTriangle size={12} /> {error}
        </p>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-end gap-2.5">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={saving || completing}
          className="min-h-11 px-5 py-2.5 sm:py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          Simpan Draft
        </button>
        <button
          type="button"
          onClick={onComplete}
          disabled={completing}
          className="min-h-11 px-5 py-2.5 sm:py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          {completing && <Loader2 size={13} className="animate-spin" />}
          Selesaikan Asesmen
        </button>
      </div>
    </div>
  )
}
