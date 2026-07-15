-- Migration: Guided MSK & Sports Assessment (TERAPI AWAL guided form)
-- Run this in the Supabase SQL editor.
--
-- One row per TERAPI AWAL patient_visits row (1:1 via visit_id UNIQUE).
-- Rich text fields store Tiptap-generated HTML; on completion a plain-text
-- synopsis is synced back onto patient_visits.diagnosis/treatment/chief_complaint/regio
-- (see app/actions/assessments.ts completeAssessment) so existing reports/exports/
-- the "Rekam Medis Belum Diisi" reminder keep working unmodified.
--
-- RLS shape: mirrors patient_visits, which per supabase/027-admin-role.sql's comment
-- ("patient_visits ... already covered by 'pv: branch staff' (branch_id match,
-- role-agnostic)") uses a role-agnostic branch-match policy rather than an explicit
-- role list. If this is ever found to be inaccurate (e.g. via
-- `SELECT * FROM pg_policies WHERE tablename = 'patient_visits'`), update the
-- branch policy below to match.

CREATE TABLE IF NOT EXISTS public.terapi_awal_assessments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id     uuid NOT NULL UNIQUE REFERENCES public.patient_visits(id) ON DELETE CASCADE,
  patient_id   uuid NOT NULL REFERENCES public.patients(id),
  branch_id    uuid NOT NULL REFERENCES public.branches(id),
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  created_by   uuid REFERENCES public.internal_profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- Step 1: Interview (Subjective & PIPs)
  history_moi           text,
  aggravating_factors    text,
  easing_factors         text,
  red_flags              text[] NOT NULL DEFAULT '{}'::text[],

  -- Step 2: Physical Examination (Objective)
  observation_gait_posture text,
  rom_active_passive       text,
  muscle_strength_mmt      text,
  special_ortho_tests      text,
  palpation                text,

  -- Step 3: Neurological Screening
  dermatomes_sensory       text,
  myotomes_motor           text,
  reflexes_neural_tension  text,

  -- Step 4: Objective Outcome Measures
  prom_used                        text CHECK (prom_used IN ('LEFS', 'SPADI', 'ODI', 'Other')),
  prom_baseline_score              numeric,
  functional_metric_test           text,
  functional_metric_baseline_value text,

  -- Step 5: Clinical Reasoning (HOAC II)
  npips                 text,
  diagnosis_hypothesis  text,

  -- Step 6: Plan of Care & Goals
  short_term_goals      text,
  long_term_goals       text,
  treatment_plan_today  text
);

CREATE INDEX IF NOT EXISTS idx_taa_branch_id  ON public.terapi_awal_assessments(branch_id);
CREATE INDEX IF NOT EXISTS idx_taa_patient_id ON public.terapi_awal_assessments(patient_id);

ALTER TABLE public.terapi_awal_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "taa_director_all" ON public.terapi_awal_assessments FOR ALL
USING (get_my_internal_role() = 'director')
WITH CHECK (get_my_internal_role() = 'director');

CREATE POLICY "taa_branch_staff_all" ON public.terapi_awal_assessments FOR ALL
USING (branch_id = get_my_branch())
WITH CHECK (branch_id = get_my_branch());
