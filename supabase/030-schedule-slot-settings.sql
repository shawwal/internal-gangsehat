-- Migration: configurable schedule time slots (Pagi/Sore) — director-managed
-- Run this in the Supabase SQL editor.
--
-- Replaces the hardcoded MORNING_SLOTS/AFTERNOON_SLOTS in
-- components/schedule/constants.ts with a DB-backed table so directors can
-- add/edit/disable the time-slot options shown in the "Tambah Jadwal" dialog
-- without a code deploy. Seeded with the exact previous hardcoded values so
-- behavior is unchanged until a director edits them.

CREATE TABLE IF NOT EXISTS public.schedule_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift       text NOT NULL CHECK (shift IN ('PAGI', 'SORE')),
  slot_time   text NOT NULL, -- 'HH:MM'
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift, slot_time)
);

ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;

-- Any logged-in internal user can read the active slot list (needed to open
-- the schedule dialog); only director can add/edit/disable slots.
CREATE POLICY "schedule_slots_select_all"
ON public.schedule_slots FOR SELECT
USING (get_my_internal_role() IS NOT NULL);

CREATE POLICY "schedule_slots_director_manage"
ON public.schedule_slots FOR ALL
USING (get_my_internal_role() = 'director')
WITH CHECK (get_my_internal_role() = 'director');

INSERT INTO public.schedule_slots (shift, slot_time) VALUES
  ('PAGI', '09:00'), ('PAGI', '10:00'), ('PAGI', '11:00'), ('PAGI', '13:00'), ('PAGI', '14:00'),
  ('SORE', '15:00'), ('SORE', '16:00'), ('SORE', '17:00'), ('SORE', '19:00'), ('SORE', '20:00')
ON CONFLICT (shift, slot_time) DO NOTHING;
