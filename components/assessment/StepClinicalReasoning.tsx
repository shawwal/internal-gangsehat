'use client'

import { ICF_SEVERITY_LABEL, ICF_SEVERITY_OPTIONS } from './types'
import type { AssessmentFormState } from './types'
import type { IcfSeverity } from '@/types'

interface Props {
  value: AssessmentFormState
  onChange: (patch: Partial<AssessmentFormState>) => void
}

const labelCls = 'block text-xs font-medium text-foreground mb-1.5'
const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
const selectCls = 'w-full px-2 py-1.5 border border-border rounded-lg text-xs bg-input focus:outline-none focus:ring-2 focus:ring-primary'

interface IcfDomainProps {
  title: string
  severityLabel: string
  notes: string
  severity: IcfSeverity | ''
  onNotesChange: (v: string) => void
  onSeverityChange: (v: IcfSeverity | '') => void
  placeholder: string
}

function IcfDomain({ title, severityLabel, notes, severity, onNotesChange, onSeverityChange, placeholder }: IcfDomainProps) {
  return (
    <div className="rounded-2xl border border-border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-foreground">{title}</label>
        <div className="w-40 shrink-0">
          <select
            value={severity}
            onChange={(e) => onSeverityChange(e.target.value as IcfSeverity | '')}
            className={selectCls}
          >
            <option value="">{severityLabel}...</option>
            {ICF_SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{ICF_SEVERITY_LABEL[s]}</option>)}
          </select>
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className={inputCls}
      />
    </div>
  )
}

export function StepClinicalReasoning({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-3 text-xs text-blue-300">
        <strong>Goal:</strong> Connect the dots between what the patient feels and what you found, using the
        ICF (International Classification of Functioning, Disability and Health) biopsychosocial model.
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Diagnosa Primer</label>
          <input
            value={value.diagnosis_primer}
            onChange={(e) => onChange({ diagnosis_primer: e.target.value })}
            placeholder="Cari atau ketik diagnosa primer..."
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Diagnosa Sekunder</label>
          <input
            value={value.diagnosis_sekunder}
            onChange={(e) => onChange({ diagnosis_sekunder: e.target.value })}
            placeholder="Cari atau ketik diagnosa sekunder (opsional)..."
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <IcfDomain
          title="Body Functions & Structures"
          severityLabel="Keparahan"
          notes={value.icf_body_functions_notes}
          severity={value.icf_body_functions_severity}
          onNotesChange={(v) => onChange({ icf_body_functions_notes: v })}
          onSeverityChange={(v) => onChange({ icf_body_functions_severity: v })}
          placeholder="Klik untuk mulai mengetik poin..."
        />
        <IcfDomain
          title="Activity Limitations"
          severityLabel="Kesulitan"
          notes={value.icf_activity_notes}
          severity={value.icf_activity_severity}
          onNotesChange={(v) => onChange({ icf_activity_notes: v })}
          onSeverityChange={(v) => onChange({ icf_activity_severity: v })}
          placeholder="Klik untuk mulai mengetik poin..."
        />
        <IcfDomain
          title="Participation Restrictions"
          severityLabel="Pembatasan"
          notes={value.icf_participation_notes}
          severity={value.icf_participation_severity}
          onNotesChange={(v) => onChange({ icf_participation_notes: v })}
          onSeverityChange={(v) => onChange({ icf_participation_severity: v })}
          placeholder="Klik untuk mulai mengetik poin..."
        />
        <IcfDomain
          title="Contextual Factors"
          severityLabel="Dampak"
          notes={value.icf_contextual_notes}
          severity={value.icf_contextual_severity}
          onNotesChange={(v) => onChange({ icf_contextual_notes: v })}
          onSeverityChange={(v) => onChange({ icf_contextual_severity: v })}
          placeholder="Klik untuk mulai mengetik poin..."
        />
      </div>
    </div>
  )
}
