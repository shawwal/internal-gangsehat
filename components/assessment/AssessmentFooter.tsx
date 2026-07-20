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
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 px-1 py-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={currentStep === 0 || saving || completing}
          className="flex-1 sm:flex-none min-h-11 px-4 py-2.5 sm:py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          Kembali
        </button>

        <button
          type="button"
          onClick={onSaveDraft}
          disabled={saving || completing}
          className="flex-1 sm:flex-none min-h-11 px-4 py-2.5 sm:py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5 whitespace-nowrap"
        >
          {saving && <Loader2 size={13} className="animate-spin shrink-0" />}
          Simpan Draft
        </button>
      </div>

      <div className="hidden sm:block flex-1" />

      {isLastStep ? (
        <button
          type="button"
          onClick={onComplete}
          disabled={completing}
          className="w-full sm:w-auto min-h-11 px-5 py-2.5 sm:py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          {completing && <Loader2 size={13} className="animate-spin" />}
          Complete Guided Assessment
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          disabled={saving || completing}
          className="w-full sm:w-auto min-h-11 px-5 py-2.5 sm:py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          Lanjut →
        </button>
      )}
    </div>
  )
}
