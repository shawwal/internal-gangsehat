-- Third shift "MIDDLE" between PAGI and SORE.
--
-- Directors add Middle time slots on /director/schedule-slots; visits booked
-- into those slots store shift = 'MIDDLE', and therapists can be scheduled on
-- a Middle shift (schedules / schedule_overrides). Only the CHECK constraints
-- change — existing PAGI/SORE rows are untouched.
--
-- Constraint names are the ones in the live schema dump
-- (_migration_extract/schema_public.sql); verify with \d <table> if a DROP
-- reports "does not exist".
--
-- Run this in your Supabase SQL editor.

ALTER TABLE public.schedule_slots DROP CONSTRAINT IF EXISTS schedule_slots_shift_check;
ALTER TABLE public.schedule_slots
  ADD CONSTRAINT schedule_slots_shift_check CHECK (shift IN ('PAGI', 'MIDDLE', 'SORE'));

ALTER TABLE public.patient_visits DROP CONSTRAINT IF EXISTS patient_visits_shift_check;
ALTER TABLE public.patient_visits
  ADD CONSTRAINT patient_visits_shift_check CHECK (shift IN ('PAGI', 'MIDDLE', 'SORE'));

ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_shift_check;
ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_shift_check CHECK (shift::text IN ('PAGI', 'MIDDLE', 'SORE'));

ALTER TABLE public.schedule_overrides DROP CONSTRAINT IF EXISTS schedule_overrides_shift_check;
ALTER TABLE public.schedule_overrides
  ADD CONSTRAINT schedule_overrides_shift_check CHECK (shift::text IN ('PAGI', 'MIDDLE', 'SORE'));
