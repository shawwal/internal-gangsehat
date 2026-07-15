'use client'

import { RichTextEditor } from './RichTextEditor'
import type { AssessmentFormState } from './types'

interface Props {
  value: AssessmentFormState
  onChange: (patch: Partial<AssessmentFormState>) => void
}

const labelCls = 'block text-xs font-medium text-foreground mb-1.5'

export function StepNeuroScreening({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-300">
        <strong>When to perform:</strong> Patient reports spinal pain, radiating pain, numbness, tingling, or weakness. Test bilaterally.
        Dermatomes: L4 (medial ankle), L5 (dorsum of foot), S1 (lateral heel/foot). Reflexes (DTR): 0=Absent, 1+=Diminished, 2+=Normal, 3+=Hyperactive, 4+=Clonus.
      </div>

      <div>
        <label className={labelCls}>Dermatomes (Sensory)</label>
        <RichTextEditor
          value={value.dermatomes_sensory}
          onChange={(html) => onChange({ dermatomes_sensory: html })}
          placeholder="e.g. Decreased sensation to light touch at L5 dermatome on the right..."
        />
      </div>

      <div>
        <label className={labelCls}>Myotomes (Motor)</label>
        <RichTextEditor
          value={value.myotomes_motor}
          onChange={(html) => onChange({ myotomes_motor: html })}
          placeholder="e.g. EHL (L5) weakness 3/5 on the right, fatigues quickly..."
        />
      </div>

      <div>
        <label className={labelCls}>Reflexes &amp; Neural Tension</label>
        <RichTextEditor
          value={value.reflexes_neural_tension}
          onChange={(html) => onChange({ reflexes_neural_tension: html })}
          placeholder="e.g. Patellar 2+ bilateral. SLR (+) on right at 45 deg..."
        />
      </div>
    </div>
  )
}
