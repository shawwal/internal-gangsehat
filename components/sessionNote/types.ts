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
  'IASTM',
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
  IASTM:         'IASTM',
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
  treatment_notes: string
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
  treatment_notes: '',
  hep_given: '',
  next_plan: '',
}

export function toFormState(a: Partial<SessionNoteFormState> | null | undefined): SessionNoteFormState {
  return { ...EMPTY_SESSION_NOTE_FORM, ...(a ?? {}) }
}

// Seed a follow-up note from the patient's Terapi Awal when there is no earlier
// session note to copy (e.g. the first SESI after the TA).
export function fromAssessment(a: {
  pain_severity_vas: number | null
  history_moi: string | null
  palpation: string | null
  special_ortho_tests: string | null
  diagnosis_primer: string | null
  diagnosis_sekunder: string | null
  treatment_plan_today: string | null
  short_term_goals: string | null
}): SessionNoteFormState {
  const diagnosis = [a.diagnosis_primer, a.diagnosis_sekunder].filter(Boolean).join(', ')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return {
    ...EMPTY_SESSION_NOTE_FORM,
    pain_scale: a.pain_severity_vas ?? 0,
    subjective_notes: a.history_moi ?? '',
    objective_findings: [a.palpation, a.special_ortho_tests].filter(Boolean).join(''),
    clinical_impression: diagnosis ? `<p>${diagnosis}</p>` : '',
    treatment_notes: a.treatment_plan_today ?? '',
    next_plan: a.short_term_goals ?? '',
  }
}

export function toFieldsInput(f: SessionNoteFormState): SessionNoteFieldsInput {
  return {
    pain_scale: f.pain_scale,
    symptom_trend: f.symptom_trend || null,
    subjective_notes: f.subjective_notes || null,
    objective_findings: f.objective_findings || null,
    clinical_impression: f.clinical_impression || null,
    treatments_performed: f.treatments_performed,
    treatment_notes: f.treatment_notes || null,
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
  treatment_notes: string | null
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
    treatment_notes: a.treatment_notes ?? '',
    hep_given: a.hep_given ?? '',
    next_plan: a.next_plan ?? '',
  }
}
