import type { SymptomTrend, TreatmentPerformed } from '@/types'
import type { SessionNoteFieldsInput } from '@/app/actions/sessionNotes'
export type { SessionNoteFieldsInput }

export const SYMPTOM_TREND_OPTIONS: SymptomTrend[] = ['IMPROVING', 'SAME', 'WORSENING']

export const SYMPTOM_TREND_LABEL: Record<SymptomTrend, string> = {
  IMPROVING: 'Membaik',
  SAME:      'Sama',
  WORSENING: 'Memburuk',
}

export const TREATMENTS_PERFORMED_OPTIONS: TreatmentPerformed[] = [
  'IR',
  'TENS',
  'EMS',
  'US',
  'ESWT',
  'TRAKSI',
  'MOBILISASI',
  'MASSAGE',
  'STRETCHING',
  'DRY_NEEDLING',
  'TAPING',
]

export const TREATMENTS_PERFORMED_LABEL: Record<TreatmentPerformed, string> = {
  IR:            'IR',
  TENS:          'TENS',
  EMS:           'EMS',
  US:            'US',
  ESWT:          'ESWT',
  TRAKSI:        'Traksi',
  MOBILISASI:    'Mobilisasi',
  MASSAGE:       'Massage',
  STRETCHING:    'Stretching',
  DRY_NEEDLING:  'Dry Needling',
  TAPING:        'Taping',
}

export interface SessionNoteFormState {
  pain_scale: number
  symptom_trend: SymptomTrend | ''
  subjective_notes: string
  objective_findings: string
  clinical_impression: string
  treatments_performed: TreatmentPerformed[]
  hep_given: string
  next_plan: string
}

export const EMPTY_SESSION_NOTE_FORM: SessionNoteFormState = {
  pain_scale: 0,
  symptom_trend: '',
  subjective_notes: '',
  objective_findings: '',
  clinical_impression: '',
  treatments_performed: [],
  hep_given: '',
  next_plan: '',
}

export function toFormState(a: Partial<SessionNoteFormState> | null | undefined): SessionNoteFormState {
  return { ...EMPTY_SESSION_NOTE_FORM, ...(a ?? {}) }
}

export function toFieldsInput(f: SessionNoteFormState): SessionNoteFieldsInput {
  return {
    pain_scale: f.pain_scale,
    symptom_trend: f.symptom_trend || null,
    subjective_notes: f.subjective_notes || null,
    objective_findings: f.objective_findings || null,
    clinical_impression: f.clinical_impression || null,
    treatments_performed: f.treatments_performed,
    hep_given: f.hep_given || null,
    next_plan: f.next_plan || null,
  }
}

export function fromSessionNote(a: {
  pain_scale: number | null
  symptom_trend: SymptomTrend | null
  subjective_notes: string | null
  objective_findings: string | null
  clinical_impression: string | null
  treatments_performed: TreatmentPerformed[]
  hep_given: string | null
  next_plan: string | null
} | null | undefined): SessionNoteFormState {
  if (!a) return EMPTY_SESSION_NOTE_FORM
  return {
    pain_scale: a.pain_scale ?? 0,
    symptom_trend: a.symptom_trend ?? '',
    subjective_notes: a.subjective_notes ?? '',
    objective_findings: a.objective_findings ?? '',
    clinical_impression: a.clinical_impression ?? '',
    treatments_performed: a.treatments_performed ?? [],
    hep_given: a.hep_given ?? '',
    next_plan: a.next_plan ?? '',
  }
}
