-- Migration: guided assessment ("Guided MSK & Sports Assessment") form mode
-- setting — director-managed, defaults to single-step (single page).
-- Run this in the Supabase SQL editor.
--
-- Extends the singleton settings row created in
-- supabase/042-session-note-form-mode-setting.sql with a second toggle for
-- the terapi_awal_assessments wizard at
-- app/(dashboard)/visits/[visitId]/assessment/page.tsx, which today is
-- hardcoded to a 6-step wizard (Interview/Physical Examination/Neurological
-- Screening/Outcome Measures/Clinical Reasoning/Plan of Care). Same table,
-- same RLS (row-level, already covers this new column) — only director can
-- write, any logged-in internal user can read.

ALTER TABLE public.session_note_settings
  ADD COLUMN IF NOT EXISTS assessment_form_mode text NOT NULL DEFAULT 'single_step'
  CHECK (assessment_form_mode IN ('single_step', 'multi_step'));
