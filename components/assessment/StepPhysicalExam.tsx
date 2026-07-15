'use client'

import { RichTextEditor } from './RichTextEditor'
import type { AssessmentFormState } from './types'

interface Props {
  value: AssessmentFormState
  onChange: (patch: Partial<AssessmentFormState>) => void
}

const labelCls = 'block text-xs font-medium text-foreground mb-1.5'

export function StepPhysicalExam({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-3 text-xs text-blue-300">
        <strong>Crucial Rule:</strong> Follow this exact sequence to avoid flaring up the patient&apos;s pain early. Do NOT palpate first! Observe → Clear Joints → Active ROM → Passive ROM → Strength → Special Tests → Palpation (last).
      </div>

      <div>
        <label className={labelCls}>1. Observation &amp; Gait / Posture</label>
        <RichTextEditor
          value={value.observation_gait_posture}
          onChange={(html) => onChange({ observation_gait_posture: html })}
          placeholder="e.g. Antalgic gait, visible swelling on lateral ankle..."
        />
      </div>

      <div>
        <label className={labelCls}>2 &amp; 3. Active &amp; Passive ROM</label>
        <RichTextEditor
          value={value.rom_active_passive}
          onChange={(html) => onChange({ rom_active_passive: html })}
          placeholder="Compare bilateral. Note pain arcs and end-feels..."
        />
      </div>

      <div>
        <label className={labelCls}>4. Muscle Strength (MMT)</label>
        <RichTextEditor
          value={value.muscle_strength_mmt}
          onChange={(html) => onChange({ muscle_strength_mmt: html })}
          placeholder="e.g. Painful and weak on resisted ankle eversion (2/5)..."
        />
      </div>

      <div>
        <label className={labelCls}>5. Special Orthopedic Tests</label>
        <RichTextEditor
          value={value.special_ortho_tests}
          onChange={(html) => onChange({ special_ortho_tests: html })}
          placeholder="e.g. Anterior Drawer (+), Talar Tilt (-)..."
        />
      </div>

      <div>
        <label className={labelCls}>6. Palpation (Done Last!)</label>
        <RichTextEditor
          value={value.palpation}
          onChange={(html) => onChange({ palpation: html })}
          placeholder="e.g. Point tenderness over the ATFL..."
        />
      </div>
    </div>
  )
}
