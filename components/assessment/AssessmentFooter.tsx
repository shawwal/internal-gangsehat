'use client'

import { Loader2 } from 'lucide-react'
import { STEP_COUNT } from './types'

interface Props {
  currentStep: number   // 0-indexed
  saving: boolean
  completing: boolean
  onBack: () => void
  onNext: () => void
  onSaveDraft: () => void
  onComplete: () => void
}

export function AssessmentFooter({ currentStep, saving, completing, onBack, onNext, onSaveDraft, onComplete }: Props) {
  const isLastStep = currentStep === STEP_COUNT - 1

  return (
    <div className="flex items-center gap-2 px-1 py-4">
      <button
        type="button"
        onClick={onBack}
        disabled={currentStep === 0 || saving || completing}
        className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Kembali
      </button>

      <button
        type="button"
        onClick={onSaveDraft}
        disabled={saving || completing}
        className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60 flex items-center gap-1.5"
      >
        {saving && <Loader2 size={13} className="animate-spin" />}
        Simpan Draft
      </button>

      <div className="flex-1" />

      {isLastStep ? (
        <button
          type="button"
          onClick={onComplete}
          disabled={completing}
          className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1.5"
        >
          {completing && <Loader2 size={13} className="animate-spin" />}
          Complete Guided Assessment
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          disabled={saving || completing}
          className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          Lanjut →
        </button>
      )}
    </div>
  )
}
