-- Migration: Follow-up SOAP Session Note (SESI TERAPI / PAKET TERAPI / SESI VISIT / PAKET VISIT)
-- Run this in the Supabase SQL editor.
--
-- One row per follow-up patient_visits row (1:1 via visit_id UNIQUE). Single-page,
-- single-submit form (see app/actions/sessionNotes.ts) — status stays for schema
-- consistency with terapi_awal_assessments but the UI only ever writes 'completed'.
-- RLS shape copied verbatim from supabase/031-terapi-awal-assessments.sql.

CREATE TABLE IF NOT EXISTS public.session_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id     uuid NOT NULL UNIQUE REFERENCES public.patient_visits(id) ON DELETE CASCADE,
  patient_id   uuid NOT NULL REFERENCES public.patients(id),
  branch_id    uuid NOT NULL REFERENCES public.branches(id),
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  created_by   uuid REFERENCES public.internal_profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- 1. Subjective
  pain_scale         smallint CHECK (pain_scale BETWEEN 0 AND 10),
  symptom_trend       text CHECK (symptom_trend IN ('IMPROVING', 'SAME', 'WORSENING')),
  subjective_notes     text,

  -- 2. Objective (ROM, Strength/MMT, Palpation, Special Tests combined)
  objective_findings    text,

  -- 3. Assessment
  clinical_impression   text,

  -- 4. Plan & Interventions Today
  treatments_performed  text[] NOT NULL DEFAULT '{}'::text[],
  hep_given              text,
  next_plan               text
);

CREATE INDEX IF NOT EXISTS idx_sn_branch_id  ON public.session_notes(branch_id);
CREATE INDEX IF NOT EXISTS idx_sn_patient_id ON public.session_notes(patient_id);

ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sn_director_all" ON public.session_notes FOR ALL
USING (get_my_internal_role() = 'director')
WITH CHECK (get_my_internal_role() = 'director');

CREATE POLICY "sn_branch_staff_all" ON public.session_notes FOR ALL
USING (branch_id = get_my_branch())
WITH CHECK (branch_id = get_my_branch());
