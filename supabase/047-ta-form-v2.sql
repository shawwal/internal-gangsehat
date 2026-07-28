-- TA assessment form v2: reordered sections, new fields, ICF Functional Framework
-- for Clinical Reasoning. Additive only — existing columns (npips,
-- diagnosis_hypothesis, muscle_strength_mmt, functional_metric_test,
-- functional_metric_baseline_value) are left in place per repo convention;
-- the UI simply stops reading/writing them.

ALTER TABLE public.terapi_awal_assessments
  ADD COLUMN IF NOT EXISTS riwayat_cedera_pengobatan text,
  ADD COLUMN IF NOT EXISTS observation_findings text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS outcome_measure_notes text,
  ADD COLUMN IF NOT EXISTS diagnosis_primer text,
  ADD COLUMN IF NOT EXISTS diagnosis_sekunder text,
  ADD COLUMN IF NOT EXISTS icf_body_functions_notes text,
  ADD COLUMN IF NOT EXISTS icf_body_functions_severity text,
  ADD COLUMN IF NOT EXISTS icf_activity_notes text,
  ADD COLUMN IF NOT EXISTS icf_activity_severity text,
  ADD COLUMN IF NOT EXISTS icf_participation_notes text,
  ADD COLUMN IF NOT EXISTS icf_participation_severity text,
  ADD COLUMN IF NOT EXISTS icf_contextual_notes text,
  ADD COLUMN IF NOT EXISTS icf_contextual_severity text;
