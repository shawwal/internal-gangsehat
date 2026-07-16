'use client'

import { RichTextEditor } from '@/components/assessment/RichTextEditor'
import type { SessionNoteFormState } from './types'

interface Props {
  value: SessionNoteFormState
  onChange: (patch: Partial<SessionNoteFormState>) => void
}

const labelCls = 'block text-xs font-medium text-foreground mb-1.5'

export function SectionAssessment({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-muted/40 border-y border-border">
        <h3 className="text-sm font-semibold text-foreground">3. Assessment</h3>
      </div>

      <div>
        <label className={labelCls}>Clinical Impression / Physio Diagnosis</label>
        <RichTextEditor
          value={value.clinical_impression}
          onChange={(html) => onChange({ clinical_impression: html })}
        />
      </div>
    </div>
  )
}
