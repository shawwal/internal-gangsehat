'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { SectionSubjective } from './SectionSubjective'
import { SectionObjective } from './SectionObjective'
import { SectionAssessment } from './SectionAssessment'
import { SectionPlan } from './SectionPlan'
import type { SessionNoteFormState } from './types'
import { stripHtml } from '@/lib/richtext'

interface Props {
  form: SessionNoteFormState
  patchForm: (patch: Partial<SessionNoteFormState>) => void
  error: string | null
  saving: boolean
  onSubmit: () => void
  readOnly?: boolean
}

const STEPS = [
  { title: 'Subjective', Section: SectionSubjective },
  { title: 'Objective', Section: SectionObjective },
  { title: 'Assessment', Section: SectionAssessment },
  { title: 'Plan', Section: SectionPlan },
] as const

export function MultiStepSessionNoteForm({ form, patchForm, error, saving, onSubmit, readOnly }: Props) {
  const [step, setStep] = useState(0)
  const [stepError, setStepError] = useState<string | null>(null)

  const isLast = step === STEPS.length - 1
  const Section = STEPS[step].Section

  function handleNext() {
    if (STEPS[step].title === 'Assessment' && !stripHtml(form.clinical_impression)) {
      setStepError('Clinical Impression / Physio Diagnosis wajib diisi.')
      return
    }
    setStepError(null)
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function handleBack() {
    setStepError(null)
    setStep((s) => Math.max(s - 1, 0))
  }

  return (
    <div className="glass-card p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <div
            key={s.title}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted-foreground/20'}`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Langkah {step + 1} dari {STEPS.length} · {STEPS[step].title}
      </p>

      <Section value={form} onChange={patchForm} readOnly={readOnly} />

      {(stepError || (isLast && error)) && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <AlertTriangle size={12} /> {stepError || error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={14} /> Kembali
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="min-h-11 px-5 py-2.5 sm:py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            Simpan Catatan Perawatan
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-1.5 px-5 py-2.5 sm:py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Lanjut <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
