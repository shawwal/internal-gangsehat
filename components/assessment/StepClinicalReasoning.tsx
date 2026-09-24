'use client'

import { useEffect, useState } from 'react'
import { ICF_SEVERITY_LABEL, ICF_SEVERITY_OPTIONS } from './types'
import type { AssessmentFormState } from './types'
import type { IcfSeverity } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { DiagnosisCombobox } from './DiagnosisCombobox'
import { RichTextEditor } from './RichTextEditor'

interface Props {
  value: AssessmentFormState
  onChange: (patch: Partial<AssessmentFormState>) => void
  readOnly?: boolean
}

const labelCls = 'block text-xs font-medium text-foreground mb-1.5'
const selectCls = 'w-full px-2 py-1.5 border border-border rounded-lg text-xs bg-input focus:outline-none focus:ring-2 focus:ring-primary'

interface IcfDomainProps {
  title: string
  severityLabel: string
  notes: string
  severity: IcfSeverity | ''
  onNotesChange: (v: string) => void
  onSeverityChange: (v: IcfSeverity | '') => void
  placeholder: string
  readOnly?: boolean
}

function IcfDomain({ title, severityLabel, notes, severity, onNotesChange, onSeverityChange, placeholder, readOnly }: IcfDomainProps) {
  return (
    <div className="rounded-2xl border border-border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-foreground">{title}</label>
        <div className="w-40 shrink-0">
          <select
            value={severity}
            onChange={(e) => onSeverityChange(e.target.value as IcfSeverity | '')}
            className={selectCls}
            disabled={readOnly}
          >
            <option value="">{severityLabel}...</option>
            {ICF_SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{ICF_SEVERITY_LABEL[s]}</option>)}
          </select>
        </div>
      </div>
      <RichTextEditor
        value={notes}
        onChange={onNotesChange}
        placeholder={placeholder}
        readOnly={readOnly}
      />
    </div>
  )
}

export function StepClinicalReasoning({ value, onChange, readOnly }: Props) {
  const [diagnosisOptions, setDiagnosisOptions] = useState<string[]>([])

  useEffect(() => {
    let active = true
    createClient()
      .from('diagnoses')
      .select('name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (active && data) setDiagnosisOptions(data.map((d) => d.name))
      })
    return () => { active = false }
  }, [])

  function handleOptionAdded(name: string) {
    setDiagnosisOptions((prev) => (prev.some((o) => o.toLowerCase() === name.toLowerCase()) ? prev : [...prev, name].sort()))
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-3 text-xs text-blue-300">
        <strong>Goal:</strong> Connect the dots between what the patient feels and what you found, using the
        ICF (International Classification of Functioning, Disability and Health) biopsychosocial model.
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Diagnosa Primer</label>
          <DiagnosisCombobox
            value={value.diagnosis_primer}
            onChange={(v) => onChange({ diagnosis_primer: v })}
            options={diagnosisOptions}
            onOptionAdded={handleOptionAdded}
            placeholder="Cari atau ketik diagnosa primer..."
            disabled={readOnly}
          />
        </div>
        <div>
          <label className={labelCls}>Diagnosa Sekunder</label>
          <DiagnosisCombobox
            value={value.diagnosis_sekunder}
            onChange={(v) => onChange({ diagnosis_sekunder: v })}
            options={diagnosisOptions}
            onOptionAdded={handleOptionAdded}
            placeholder="Cari atau ketik diagnosa sekunder (opsional)..."
            disabled={readOnly}
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
          readOnly={readOnly}
        />
        <IcfDomain
          title="Activity Limitations"
          severityLabel="Kesulitan"
          notes={value.icf_activity_notes}
          severity={value.icf_activity_severity}
          onNotesChange={(v) => onChange({ icf_activity_notes: v })}
          onSeverityChange={(v) => onChange({ icf_activity_severity: v })}
          placeholder="Klik untuk mulai mengetik poin..."
          readOnly={readOnly}
        />
        <IcfDomain
          title="Participation Restrictions"
          severityLabel="Pembatasan"
          notes={value.icf_participation_notes}
          severity={value.icf_participation_severity}
          onNotesChange={(v) => onChange({ icf_participation_notes: v })}
          onSeverityChange={(v) => onChange({ icf_participation_severity: v })}
          placeholder="Klik untuk mulai mengetik poin..."
          readOnly={readOnly}
        />
        <IcfDomain
          title="Contextual Factors"
          severityLabel="Dampak"
          notes={value.icf_contextual_notes}
          severity={value.icf_contextual_severity}
          onNotesChange={(v) => onChange({ icf_contextual_notes: v })}
          onSeverityChange={(v) => onChange({ icf_contextual_severity: v })}
          placeholder="Klik untuk mulai mengetik poin..."
          readOnly={readOnly}
        />
      </div>
    </div>
  )
}
