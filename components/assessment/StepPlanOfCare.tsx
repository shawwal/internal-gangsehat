'use client'

import { RichTextEditor } from './RichTextEditor'
import type { AssessmentFormState } from './types'

interface Props {
  value: AssessmentFormState
  onChange: (patch: Partial<AssessmentFormState>) => void
}

const labelCls = 'block text-xs font-medium text-foreground mb-1.5'

export function StepPlanOfCare({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-3 text-xs text-blue-300">
        <strong>Goal:</strong> Set realistic milestones tied to the ICF framework.
        <br />
        Hint: Your Short-Term Goal should target the objective metric you recorded in Step 4.
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Short-Term Goals (Impairment Level)</label>
          <RichTextEditor
            value={value.short_term_goals}
            onChange={(html) => onChange({ short_term_goals: html })}
            placeholder="e.g. Increase LEFS score to 60/80 and achieve pain-free AROM in 2 weeks..."
          />
        </div>
        <div>
          <label className={labelCls}>Long-Term Goals (Participation Level)</label>
          <RichTextEditor
            value={value.long_term_goals}
            onChange={(html) => onChange({ long_term_goals: html })}
            placeholder="e.g. Return to 90 mins of football without pain in 6 weeks..."
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Treatment Plan for Today</label>
        <RichTextEditor
          value={value.treatment_plan_today}
          onChange={(html) => onChange({ treatment_plan_today: html })}
          placeholder="What specific interventions were performed today?"
        />
      </div>
    </div>
  )
}
