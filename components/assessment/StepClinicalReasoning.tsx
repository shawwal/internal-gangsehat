'use client'

import { RichTextEditor } from './RichTextEditor'
import type { AssessmentFormState } from './types'

interface Props {
  value: AssessmentFormState
  onChange: (patch: Partial<AssessmentFormState>) => void
}

const labelCls = 'block text-xs font-medium text-foreground mb-1.5'

export function StepClinicalReasoning({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-3 text-xs text-blue-300">
        <strong>Goal:</strong> Connect the dots between what the patient feels and what you found.
        NPIPs = what biomechanical flaws <em>you</em> found that the patient didn&apos;t know about.
      </div>

      <div>
        <label className={labelCls}>Physiotherapist-Identified Problems (NPIPs)</label>
        <RichTextEditor
          value={value.npips}
          onChange={(html) => onChange({ npips: html })}
          placeholder="e.g. Poor core control, tight hamstrings, valgus collapse during squat..."
        />
      </div>

      <div>
        <label className={labelCls}>Physiotherapy Diagnosis / Hypothesis</label>
        <RichTextEditor
          value={value.diagnosis_hypothesis}
          onChange={(html) => onChange({ diagnosis_hypothesis: html })}
          placeholder="Summarize the injury and the underlying biomechanical or neurological cause..."
        />
      </div>
    </div>
  )
}
