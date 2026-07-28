import type {
  RedFlag, PromType,
  PainOnset, PainCharacter, PainRadiation, PainAssociatedSymptom, PainTimeCourse,
  JointExamRow, AromResult, PromEndFeel, IsometricResistance,
  DermatomeStatus, MyotomeStatus, ReflexStatus,
} from '@/types'
import type { AssessmentFieldsInput } from '@/app/actions/assessments'
export type { AssessmentFieldsInput }

export const RED_FLAG_LABEL: Record<RedFlag, string> = {
  UNEXPLAINED_WEIGHT_LOSS:      'Unexplained weight loss',
  NIGHT_SWEATS_FEVER:           'Night sweats / Fever',
  HISTORY_OF_CANCER:            'History of cancer',
  BILATERAL_TINGLING_NUMBNESS:  'Bilateral tingling/numbness',
  SADDLE_ANESTHESIA_BOWEL:      'Saddle anesthesia / Bowel issues',
  TRAUMA_INABILITY_BEAR_WEIGHT: 'Trauma with inability to bear weight',
  NONE:                         'None',
}

export const RED_FLAG_OPTIONS: RedFlag[] = [
  'UNEXPLAINED_WEIGHT_LOSS',
  'NIGHT_SWEATS_FEVER',
  'HISTORY_OF_CANCER',
  'BILATERAL_TINGLING_NUMBNESS',
  'SADDLE_ANESTHESIA_BOWEL',
  'TRAUMA_INABILITY_BEAR_WEIGHT',
  'NONE',
]

export const PROM_OPTIONS: PromType[] = ['LEFS', 'SPADI', 'ODI', 'Other']

// SOCRATES pain-history options (migration 045)
export const PAIN_ONSET_LABEL: Record<PainOnset, string> = {
  Sudden: 'Tiba-tiba / Traumatis',
  Gradual: 'Bertahap',
  Insidious: 'Tidak diketahui penyebabnya (Insidious)',
  TidakDiperiksa: 'Tidak Diperiksa',
}
export const PAIN_ONSET_OPTIONS: PainOnset[] = ['Sudden', 'Gradual', 'Insidious', 'TidakDiperiksa']

export const PAIN_CHARACTER_LABEL: Record<PainCharacter, string> = {
  Sharp: 'Tajam / Ditusuk',
  Dull: 'Pegal / Ngilu',
  Burning: 'Panas / Terbakar',
  Shooting: 'Menjalar / Kesetrum',
  Throbbing: 'Berdenyut',
  Other: 'Lainnya',
  TidakDiperiksa: 'Tidak Diperiksa',
}
export const PAIN_CHARACTER_OPTIONS: PainCharacter[] = ['Sharp', 'Dull', 'Burning', 'Shooting', 'Throbbing', 'Other', 'TidakDiperiksa']

export const PAIN_RADIATION_LABEL: Record<PainRadiation, string> = {
  None: 'Tidak Ada Penjalaran',
  DownArm: 'Ya - Menjalar ke lengan',
  DownLeg: 'Ya - Menjalar ke kaki',
  Other: 'Ya - Lainnya (Tulis di catatan)',
  TidakDiperiksa: 'Tidak Diperiksa',
}
export const PAIN_RADIATION_OPTIONS: PainRadiation[] = ['None', 'DownArm', 'DownLeg', 'Other', 'TidakDiperiksa']

export const PAIN_ASSOCIATED_SYMPTOM_LABEL: Record<PainAssociatedSymptom, string> = {
  Numbness: 'Kebas (Mati rasa)',
  Tingling: 'Kesemutan',
  Clicking: 'Bunyi Klik / Krek',
  Locking: 'Terkunci (Locking)',
  GivingWay: 'Lemah / Goyah (Giving Way)',
  Swelling: 'Bengkak',
  Hipertensi: 'Hipertensi',
  Kolesterol: 'Kolesterol',
  GulaDarah: 'Gula Darah',
  AsamUrat: 'Asam Urat',
  None: 'Tidak Ada',
  TidakDiperiksa: 'Tidak Diperiksa',
}
export const PAIN_ASSOCIATED_SYMPTOM_OPTIONS: PainAssociatedSymptom[] = [
  'None', 'Numbness', 'Tingling', 'Clicking', 'Locking', 'GivingWay', 'Swelling',
  'Hipertensi', 'Kolesterol', 'GulaDarah', 'AsamUrat', 'TidakDiperiksa',
]

export const PAIN_TIME_COURSE_LABEL: Record<PainTimeCourse, string> = {
  Constant: 'Terus-menerus',
  Intermittent: 'Hilang Timbul',
  WorseAM: 'Memburuk di Pagi Hari',
  WorsePM: 'Memburuk di Malam Hari',
  NightPain: 'Terbangun di Malam Hari',
  TidakDiperiksa: 'Tidak Diperiksa',
}
export const PAIN_TIME_COURSE_OPTIONS: PainTimeCourse[] = ['Constant', 'Intermittent', 'WorseAM', 'WorsePM', 'NightPain', 'TidakDiperiksa']

// Structured joint/movement exam table options (migration 045)
export const AROM_LABEL: Record<AromResult, string> = {
  WNL: 'Dalam Batas Normal',
  Restricted: 'Terbatas',
  Painful: 'Nyeri',
  Restricted_Painful: 'Terbatas & Nyeri',
  TidakDiperiksa: 'Tidak Diperiksa',
}
export const AROM_OPTIONS: AromResult[] = ['WNL', 'Restricted', 'Painful', 'Restricted_Painful', 'TidakDiperiksa']

export const PROM_ENDFEEL_LABEL: Record<PromEndFeel, string> = {
  Normal: 'Normal',
  Bone: 'Tulang-ke-tulang (Keras)',
  Soft: 'Jaringan lunak (Empuk)',
  Tissue: 'Regangan jaringan (Kenyal)',
  Empty: 'Kosong (Patologis/Nyeri)',
  TidakDiperiksa: 'Tidak Diperiksa',
}
export const PROM_ENDFEEL_OPTIONS: PromEndFeel[] = ['Normal', 'Bone', 'Soft', 'Tissue', 'Empty', 'TidakDiperiksa']

export const ISOMETRIC_LABEL: Record<IsometricResistance, string> = {
  Strong_Painless: 'Kuat & Tanpa Nyeri',
  Strong_Painful: 'Kuat & Nyeri',
  Weak_Painful: 'Lemah & Nyeri',
  Weak_Painless: 'Lemah & Tanpa Nyeri',
  TidakDiperiksa: 'Tidak Diperiksa',
}
export const ISOMETRIC_OPTIONS: IsometricResistance[] = ['Strong_Painless', 'Strong_Painful', 'Weak_Painful', 'Weak_Painless', 'TidakDiperiksa']

export function emptyJointExamRow(): JointExamRow {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `row-${Date.now()}-${Math.random()}`
  return { id, joint: '', arom: '', prom: '', isometric: '' }
}

// Structured neurological screening options (migration 045)
export const DERMATOME_STATUS_LABEL: Record<DermatomeStatus, string> = {
  Intact: 'Utuh / Normal bilateral',
  Impaired: 'Terganggu (Catat di bawah)',
  Absent: 'Tidak Ada',
  NotTested: 'Tidak Diperiksa',
}
export const DERMATOME_STATUS_OPTIONS: DermatomeStatus[] = ['Intact', 'Impaired', 'Absent', 'NotTested']

export const MYOTOME_STATUS_LABEL: Record<MyotomeStatus, string> = {
  Intact: 'Utuh / Kekuatan 5/5',
  Impaired: 'Ada Kelemahan',
  NotTested: 'Tidak Diperiksa',
}
export const MYOTOME_STATUS_OPTIONS: MyotomeStatus[] = ['Intact', 'Impaired', 'NotTested']

export const REFLEX_STATUS_LABEL: Record<ReflexStatus, string> = {
  Normal: 'Normal (2+)',
  Hyporeflexive: 'Hiporefleksia (1+)',
  Hyperreflexive: 'Hiperrefleksia (3+)',
  Absent: 'Tidak Ada (0)',
  NotTested: 'Tidak Diperiksa',
}
export const REFLEX_STATUS_OPTIONS: ReflexStatus[] = ['Normal', 'Hyporeflexive', 'Hyperreflexive', 'Absent', 'NotTested']

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
// rom_active_passive/dermatomes_sensory/myotomes_motor/reflexes_neural_tension are
// carried through unedited (legacy pre-045 free text, read-only fallback UI only —
// see StepPhysicalExam/StepNeuroScreening) so drafts never lose that historical text.
export interface AssessmentFormState {
  history_moi: string
  aggravating_factors: string
  easing_factors: string
  red_flags: RedFlag[]
  pain_site: string
  pain_onset: PainOnset | ''
  pain_character: PainCharacter | ''
  pain_radiation: PainRadiation | ''
  pain_associated_symptoms: PainAssociatedSymptom[]
  pain_time_course: PainTimeCourse | ''
  pain_severity_vas: number
  observation_gait_posture: string
  rom_active_passive: string
  joint_exam_rows: JointExamRow[]
  muscle_strength_mmt: string
  special_ortho_tests: string
  palpation: string
  dermatomes_sensory: string
  myotomes_motor: string
  reflexes_neural_tension: string
  dermatomes_status: DermatomeStatus | ''
  dermatomes_notes: string
  myotomes_status: MyotomeStatus | ''
  myotomes_notes: string
  reflexes_status: ReflexStatus | ''
  reflexes_notes: string
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
  pain_site: '',
  pain_onset: '',
  pain_character: '',
  pain_radiation: '',
  pain_associated_symptoms: [],
  pain_time_course: '',
  pain_severity_vas: 0,
  observation_gait_posture: '',
  rom_active_passive: '',
  joint_exam_rows: [],
  muscle_strength_mmt: '',
  special_ortho_tests: '',
  palpation: '',
  dermatomes_sensory: '',
  myotomes_motor: '',
  reflexes_neural_tension: '',
  dermatomes_status: '',
  dermatomes_notes: '',
  myotomes_status: '',
  myotomes_notes: '',
  reflexes_status: '',
  reflexes_notes: '',
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
    pain_site: f.pain_site || null,
    pain_onset: f.pain_onset || null,
    pain_character: f.pain_character || null,
    pain_radiation: f.pain_radiation || null,
    pain_associated_symptoms: f.pain_associated_symptoms,
    pain_time_course: f.pain_time_course || null,
    pain_severity_vas: f.pain_severity_vas,
    observation_gait_posture: f.observation_gait_posture || null,
    rom_active_passive: f.rom_active_passive || null,
    joint_exam_rows: f.joint_exam_rows,
    muscle_strength_mmt: f.muscle_strength_mmt || null,
    special_ortho_tests: f.special_ortho_tests || null,
    palpation: f.palpation || null,
    dermatomes_sensory: f.dermatomes_sensory || null,
    myotomes_motor: f.myotomes_motor || null,
    reflexes_neural_tension: f.reflexes_neural_tension || null,
    dermatomes_status: f.dermatomes_status || null,
    dermatomes_notes: f.dermatomes_notes || null,
    myotomes_status: f.myotomes_status || null,
    myotomes_notes: f.myotomes_notes || null,
    reflexes_status: f.reflexes_status || null,
    reflexes_notes: f.reflexes_notes || null,
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
  pain_site: string | null
  pain_onset: PainOnset | null
  pain_character: PainCharacter | null
  pain_radiation: PainRadiation | null
  pain_associated_symptoms: PainAssociatedSymptom[]
  pain_time_course: PainTimeCourse | null
  pain_severity_vas: number | null
  observation_gait_posture: string | null
  rom_active_passive: string | null
  joint_exam_rows: JointExamRow[]
  muscle_strength_mmt: string | null
  special_ortho_tests: string | null
  palpation: string | null
  dermatomes_sensory: string | null
  myotomes_motor: string | null
  reflexes_neural_tension: string | null
  dermatomes_status: DermatomeStatus | null
  dermatomes_notes: string | null
  myotomes_status: MyotomeStatus | null
  myotomes_notes: string | null
  reflexes_status: ReflexStatus | null
  reflexes_notes: string | null
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
  if (!a) return { ...EMPTY_ASSESSMENT_FORM, joint_exam_rows: [emptyJointExamRow()] }
  return {
    history_moi: a.history_moi ?? '',
    aggravating_factors: a.aggravating_factors ?? '',
    easing_factors: a.easing_factors ?? '',
    red_flags: a.red_flags ?? [],
    pain_site: a.pain_site ?? '',
    pain_onset: a.pain_onset ?? '',
    pain_character: a.pain_character ?? '',
    pain_radiation: a.pain_radiation ?? '',
    pain_associated_symptoms: a.pain_associated_symptoms ?? [],
    pain_time_course: a.pain_time_course ?? '',
    pain_severity_vas: a.pain_severity_vas ?? 0,
    observation_gait_posture: a.observation_gait_posture ?? '',
    rom_active_passive: a.rom_active_passive ?? '',
    joint_exam_rows: a.joint_exam_rows?.length ? a.joint_exam_rows : [emptyJointExamRow()],
    muscle_strength_mmt: a.muscle_strength_mmt ?? '',
    special_ortho_tests: a.special_ortho_tests ?? '',
    palpation: a.palpation ?? '',
    dermatomes_sensory: a.dermatomes_sensory ?? '',
    myotomes_motor: a.myotomes_motor ?? '',
    reflexes_neural_tension: a.reflexes_neural_tension ?? '',
    dermatomes_status: a.dermatomes_status ?? '',
    dermatomes_notes: a.dermatomes_notes ?? '',
    myotomes_status: a.myotomes_status ?? '',
    myotomes_notes: a.myotomes_notes ?? '',
    reflexes_status: a.reflexes_status ?? '',
    reflexes_notes: a.reflexes_notes ?? '',
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
