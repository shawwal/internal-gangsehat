-- Migration: restructure Terapi Awal (TA) assessment — SOCRATES pain history,
-- expanded Red Flags, structured joint/movement exam table, and structured
-- neurological screening — to match the reference clinical EMR intake form.
-- Run this in the Supabase SQL editor.
--
-- Adds new structured columns alongside (not replacing) the existing free-text
-- columns rom_active_passive / dermatomes_sensory / myotomes_motor /
-- reflexes_neural_tension, which are kept for existing in-flight drafts and
-- completed historical records — no DROP COLUMN. New assessments never write
-- to those columns again (see components/assessment/types.ts); the 3 step
-- components render them read-only when present and the new structured field
-- is still empty.
--
-- Red Flags: RedFlag TS union (types/index.ts) gains HISTORY_OF_CANCER and
-- TRAUMA_INABILITY_BEAR_WEIGHT alongside the 4 existing values; red_flags stays
-- a plain text[] with no CHECK constraint, so no data migration is needed here.

ALTER TABLE public.terapi_awal_assessments
  -- Step 1: SOCRATES-style pain history
  ADD COLUMN IF NOT EXISTS pain_site                 text,
  ADD COLUMN IF NOT EXISTS pain_onset                text
    CHECK (pain_onset IN ('Sudden','Gradual','Insidious','TidakDiperiksa')),
  ADD COLUMN IF NOT EXISTS pain_character             text
    CHECK (pain_character IN ('Sharp','Dull','Burning','Shooting','Throbbing','Other','TidakDiperiksa')),
  ADD COLUMN IF NOT EXISTS pain_radiation              text
    CHECK (pain_radiation IN ('None','DownArm','DownLeg','Other','TidakDiperiksa')),
  ADD COLUMN IF NOT EXISTS pain_associated_symptoms    text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS pain_time_course            text
    CHECK (pain_time_course IN ('Constant','Intermittent','WorseAM','WorsePM','NightPain','TidakDiperiksa')),
  ADD COLUMN IF NOT EXISTS pain_severity_vas           smallint
    CHECK (pain_severity_vas BETWEEN 0 AND 10),

  -- Step 2: structured joint/movement exam table (repeatable rows)
  ADD COLUMN IF NOT EXISTS joint_exam_rows             jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Step 3: structured neurological screening (status + free-text notes)
  ADD COLUMN IF NOT EXISTS dermatomes_status           text
    CHECK (dermatomes_status IN ('Intact','Impaired','Absent','NotTested')),
  ADD COLUMN IF NOT EXISTS dermatomes_notes            text,
  ADD COLUMN IF NOT EXISTS myotomes_status             text
    CHECK (myotomes_status IN ('Intact','Impaired','NotTested')),
  ADD COLUMN IF NOT EXISTS myotomes_notes              text,
  ADD COLUMN IF NOT EXISTS reflexes_status             text
    CHECK (reflexes_status IN ('Normal','Hyporeflexive','Hyperreflexive','Absent','NotTested')),
  ADD COLUMN IF NOT EXISTS reflexes_notes              text;

-- No RLS changes needed: taa_director_all / taa_branch_staff_all (031) are
-- table-level FOR ALL policies with no column list, already cover these.
