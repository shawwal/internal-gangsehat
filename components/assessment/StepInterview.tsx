'use client'

import { RichTextEditor } from './RichTextEditor'
import { RED_FLAG_LABEL, RED_FLAG_OPTIONS } from './types'
import type { AssessmentFormState } from './types'
import type { RedFlag } from '@/types'

interface Props {
  value: AssessmentFormState
  onChange: (patch: Partial<AssessmentFormState>) => void
}

const labelCls = 'block text-xs font-medium text-foreground mb-1.5'

export function StepInterview({ value, onChange }: Props) {
  function toggleRedFlag(flag: RedFlag) {
    if (flag === 'NONE') {
      onChange({ red_flags: value.red_flags.includes('NONE') ? [] : ['NONE'] })
      return
    }
    const withoutNone = value.red_flags.filter((f) => f !== 'NONE')
    const next = withoutNone.includes(flag)
      ? withoutNone.filter((f) => f !== flag)
      : [...withoutNone, flag]
    onChange({ red_flags: next })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-3 text-xs text-blue-300">
        <strong>Goal:</strong> Understand the Patient-Identified Problems (PIPs). Let the patient tell their story first.
      </div>

      <div>
        <label className={labelCls}>History &amp; Mechanism of Injury (MOI)</label>
        <RichTextEditor
          value={value.history_moi}
          onChange={(html) => onChange({ history_moi: html })}
          placeholder="Exactly how did it happen? Did you hear a pop/crack?"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Aggravating Factors (Makes it worse)</label>
          <RichTextEditor
            value={value.aggravating_factors}
            onChange={(html) => onChange({ aggravating_factors: html })}
          />
        </div>
        <div>
          <label className={labelCls}>Easing Factors (Makes it better)</label>
          <RichTextEditor
            value={value.easing_factors}
            onChange={(html) => onChange({ easing_factors: html })}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Red Flags Screening</label>
        <div className="flex flex-wrap gap-3">
          {RED_FLAG_OPTIONS.map((flag) => (
            <label key={flag} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={value.red_flags.includes(flag)}
                onChange={() => toggleRedFlag(flag)}
                className="rounded border-border accent-primary"
              />
              {RED_FLAG_LABEL[flag]}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
