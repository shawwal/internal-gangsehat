import type { RedFlag, PromType } from '@/types'
import type { AssessmentFieldsInput } from '@/app/actions/assessments'
export type { AssessmentFieldsInput }

export const RED_FLAG_LABEL: Record<RedFlag, string> = {
  UNEXPLAINED_WEIGHT_LOSS:      'Unexplained weight loss',
  NIGHT_SWEATS_FEVER:           'Night sweats / Fever',
  BILATERAL_TINGLING_NUMBNESS:  'Bilateral tingling/numbness',
  SADDLE_ANESTHESIA_BOWEL:      'Saddle anesthesia / Bowel issues',
  NONE:                         'None',
}

export const RED_FLAG_OPTIONS: RedFlag[] = [
  'UNEXPLAINED_WEIGHT_LOSS',
  'NIGHT_SWEATS_FEVER',
  'BILATERAL_TINGLING_NUMBNESS',
  'SADDLE_ANESTHESIA_BOWEL',
  'NONE',
]

export const PROM_OPTIONS: PromType[] = ['LEFS', 'SPADI', 'ODI', 'Other']

export const STEP_LABELS = [
  'Interview',
  'Physical Examination',
  'Neurological Screening',
  'Outcome Measures',
  'Clinical Reasoning',
  'Plan of Care',
] as const

export const STEP_COUNT = STEP_LABELS.length

// String-based form shape mirrored from MedicalRecordModal's FormState/toForm pattern —
// mutable local editing state, converted to AssessmentFieldsInput on save.
export interface AssessmentFormState {
  history_moi: string
  aggravating_factors: string
  easing_factors: string
  red_flags: RedFlag[]
  observation_gait_posture: string
  rom_active_passive: string
  muscle_strength_mmt: string
  special_ortho_tests: string
  palpation: string
  dermatomes_sensory: string
  myotomes_motor: string
  reflexes_neural_tension: string
  prom_used: PromType | ''
  prom_baseline_score: string
  functional_metric_test: string
  functional_metric_baseline_value: string
  npips: string
  diagnosis_hypothesis: string
  short_term_goals: string
  long_term_goals: string
  treatment_plan_today: string
}

export const EMPTY_ASSESSMENT_FORM: AssessmentFormState = {
  history_moi: '',
  aggravating_factors: '',
  easing_factors: '',
  red_flags: [],
  observation_gait_posture: '',
  rom_active_passive: '',
  muscle_strength_mmt: '',
  special_ortho_tests: '',
  palpation: '',
  dermatomes_sensory: '',
  myotomes_motor: '',
  reflexes_neural_tension: '',
  prom_used: '',
  prom_baseline_score: '',
  functional_metric_test: '',
  functional_metric_baseline_value: '',
  npips: '',
  diagnosis_hypothesis: '',
  short_term_goals: '',
  long_term_goals: '',
  treatment_plan_today: '',
}

export function toFormState(a: Partial<AssessmentFormState> | null | undefined): AssessmentFormState {
  return { ...EMPTY_ASSESSMENT_FORM, ...(a ?? {}) }
}

export function toFieldsInput(f: AssessmentFormState): AssessmentFieldsInput {
  return {
    history_moi: f.history_moi || null,
    aggravating_factors: f.aggravating_factors || null,
    easing_factors: f.easing_factors || null,
    red_flags: f.red_flags,
    observation_gait_posture: f.observation_gait_posture || null,
    rom_active_passive: f.rom_active_passive || null,
    muscle_strength_mmt: f.muscle_strength_mmt || null,
    special_ortho_tests: f.special_ortho_tests || null,
    palpation: f.palpation || null,
    dermatomes_sensory: f.dermatomes_sensory || null,
    myotomes_motor: f.myotomes_motor || null,
    reflexes_neural_tension: f.reflexes_neural_tension || null,
    prom_used: f.prom_used || null,
    prom_baseline_score: f.prom_baseline_score ? Number(f.prom_baseline_score) : null,
    functional_metric_test: f.functional_metric_test || null,
    functional_metric_baseline_value: f.functional_metric_baseline_value || null,
    npips: f.npips || null,
    diagnosis_hypothesis: f.diagnosis_hypothesis || null,
    short_term_goals: f.short_term_goals || null,
    long_term_goals: f.long_term_goals || null,
    treatment_plan_today: f.treatment_plan_today || null,
  }
}

export function fromAssessment(a: {
  history_moi: string | null
  aggravating_factors: string | null
  easing_factors: string | null
  red_flags: RedFlag[]
  observation_gait_posture: string | null
  rom_active_passive: string | null
  muscle_strength_mmt: string | null
  special_ortho_tests: string | null
  palpation: string | null
  dermatomes_sensory: string | null
  myotomes_motor: string | null
  reflexes_neural_tension: string | null
  prom_used: PromType | null
  prom_baseline_score: number | null
  functional_metric_test: string | null
  functional_metric_baseline_value: string | null
  npips: string | null
  diagnosis_hypothesis: string | null
  short_term_goals: string | null
  long_term_goals: string | null
  treatment_plan_today: string | null
} | null | undefined): AssessmentFormState {
  if (!a) return EMPTY_ASSESSMENT_FORM
  return {
    history_moi: a.history_moi ?? '',
    aggravating_factors: a.aggravating_factors ?? '',
    easing_factors: a.easing_factors ?? '',
    red_flags: a.red_flags ?? [],
    observation_gait_posture: a.observation_gait_posture ?? '',
    rom_active_passive: a.rom_active_passive ?? '',
    muscle_strength_mmt: a.muscle_strength_mmt ?? '',
    special_ortho_tests: a.special_ortho_tests ?? '',
    palpation: a.palpation ?? '',
    dermatomes_sensory: a.dermatomes_sensory ?? '',
    myotomes_motor: a.myotomes_motor ?? '',
    reflexes_neural_tension: a.reflexes_neural_tension ?? '',
    prom_used: a.prom_used ?? '',
    prom_baseline_score: a.prom_baseline_score != null ? String(a.prom_baseline_score) : '',
    functional_metric_test: a.functional_metric_test ?? '',
    functional_metric_baseline_value: a.functional_metric_baseline_value ?? '',
    npips: a.npips ?? '',
    diagnosis_hypothesis: a.diagnosis_hypothesis ?? '',
    short_term_goals: a.short_term_goals ?? '',
    long_term_goals: a.long_term_goals ?? '',
    treatment_plan_today: a.treatment_plan_today ?? '',
  }
}
