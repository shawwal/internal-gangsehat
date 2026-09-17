-- Migration: Griya Anak weekly master schedule no longer pins a fixed therapist.
-- Run this in the Supabase SQL editor, after 077.
--
-- Griya Anak's admin wants two separate concepts: a Weekly Schedule (MASTER) of
-- Day+Time+Patient+Service with NO therapist, and a Daily Schedule that resolves
-- the therapist automatically each day from whoever's rolling working schedule
-- (public.schedules) covers that discipline at that time — so therapist rotation
-- never requires touching the patient's permanent booking.
--
-- griya_schedule_slots.therapist_id was previously NOT NULL and the sole way a
-- child got placed in the weekly grid (clicking a specific therapist's column).
-- That's no longer how a master row is created; therapist_id becomes purely a
-- legacy/informational value on old rows and is never written for new ones.

ALTER TABLE public.griya_schedule_slots
  ALTER COLUMN therapist_id DROP NOT NULL;

-- Old collision guard was "this therapist cell is taken" — no longer meaningful
-- once therapist isn't part of the master. New guard: a child can't have two
-- active master bookings in the SAME discipline at the same day+time — a child
-- can legitimately have e.g. Fisioterapi AND Terapi Wicara at the same slot_time,
-- so discipline must be part of the key (a first attempt without it failed on
-- exactly this case).
DROP INDEX IF EXISTS griya_slot_active_cell_uniq;
DROP INDEX IF EXISTS griya_slot_active_patient_time_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS griya_slot_active_patient_time_uniq
  ON public.griya_schedule_slots (patient_id, hari, slot_time, discipline)
  WHERE status = 'active' AND end_date IS NULL;
