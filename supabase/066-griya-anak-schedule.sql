-- Migration: Jadwal Griya Anak — weekly student timetable (Milestone 1)
-- Run this in the Supabase SQL editor.
--
-- Griya Anak Gang Sehat runs a fixed weekly timetable (unlike the adult
-- fisioterapi clinics served by /jadwal-harian): each child sits in a
-- recurring slot (weekday + hour + therapist, grouped by discipline) that
-- repeats every week until they graduate/stop. This migration adds:
--   1. branch_griya_settings   — per-branch on/off toggle (gates all Griya
--      Anak nav items: jadwal + pengaturan + toko). Mirrors
--      branch_sport_massage_settings (055).
--   2. griya_therapists        — the timetable's column config (which
--      internal_profiles are columns, their discipline, and left-to-right
--      order). internal_profiles has no discipline field of its own.
--   3. griya_schedule_slots    — the recurring enrolment: one row per
--      child-slot. This is the "template".
--   4. patient_visits.griya_slot_id — links a realised session (attendance,
--      payment, substitute, this-week move) back to its recurring template.
--      A week's patient_visits rows are created lazily, only when something
--      happens to a cell — never pre-generated.
--
-- RLS shape follows 031-terapi-awal-assessments.sql (director-all + a
-- branch-match policy) and 055-sport-massage-branch-settings.sql (settings
-- table). Therapist view-only is enforced here (SELECT-only branch policy)
-- and again in app/actions/griyaJadwal.ts.

-- ── 1. branch_griya_settings ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.branch_griya_settings (
  branch_id  uuid PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
  enabled    boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.internal_profiles(id)
);

ALTER TABLE public.branch_griya_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branch_griya_settings_select_all"
ON public.branch_griya_settings FOR SELECT
USING (get_my_internal_role() IS NOT NULL);

CREATE POLICY "branch_griya_settings_director_manage"
ON public.branch_griya_settings FOR ALL
USING (get_my_internal_role() = 'director')
WITH CHECK (get_my_internal_role() = 'director');

CREATE POLICY "branch_griya_settings_manager_manage_own"
ON public.branch_griya_settings FOR ALL
USING (get_my_internal_role() = 'manager' AND branch_id = get_my_branch())
WITH CHECK (get_my_internal_role() = 'manager' AND branch_id = get_my_branch());

-- Enable for Griya Anak Gang Sehat.
INSERT INTO public.branch_griya_settings (branch_id, enabled)
SELECT id, true FROM public.branches WHERE name ILIKE '%Griya Anak%'
ON CONFLICT (branch_id) DO UPDATE SET enabled = true;

-- ── 2. griya_therapists ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.griya_therapists (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  therapist_id  uuid NOT NULL REFERENCES public.internal_profiles(id) ON DELETE CASCADE,
  discipline    text NOT NULL CHECK (discipline IN ('FISIOTERAPI', 'TERAPI_WICARA', 'TERAPI_PERILAKU', 'PSIKOLOG')),
  display_order int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, therapist_id)
);

CREATE INDEX IF NOT EXISTS idx_griya_therapists_branch ON public.griya_therapists (branch_id, is_active);

ALTER TABLE public.griya_therapists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "griya_therapists_director_all"
ON public.griya_therapists FOR ALL
USING (get_my_internal_role() = 'director')
WITH CHECK (get_my_internal_role() = 'director');

CREATE POLICY "griya_therapists_branch_write"
ON public.griya_therapists FOR ALL
USING (get_my_internal_role() IN ('admin', 'manager') AND branch_id = get_my_branch())
WITH CHECK (get_my_internal_role() IN ('admin', 'manager') AND branch_id = get_my_branch());

CREATE POLICY "griya_therapists_branch_read"
ON public.griya_therapists FOR SELECT
USING (branch_id = get_my_branch());

-- Seed the current Griya Anak columns by nickname/full_name match. Best-effort:
-- any that don't match can be added/reordered later in the "Kelola Terapis"
-- panel on /griya-anak/jadwal.
DO $$
DECLARE
  v_branch uuid;
  rec record;
BEGIN
  SELECT id INTO v_branch FROM public.branches WHERE name ILIKE '%Griya Anak%' LIMIT 1;
  IF v_branch IS NULL THEN RETURN; END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      ('miswi', 'FISIOTERAPI',     10),
      ('edo',   'FISIOTERAPI',     20),
      ('irma',  'FISIOTERAPI',     30),
      ('lulu',  'FISIOTERAPI',     40),
      ('tia',   'FISIOTERAPI',     50),
      ('adel',  'TERAPI_WICARA',   60),
      ('chita', 'TERAPI_WICARA',   70),
      ('yuyun', 'TERAPI_PERILAKU', 80),
      ('stefy', 'TERAPI_PERILAKU', 90),
      ('isti',  'PSIKOLOG',        100)
    ) AS t(nick, discipline, ord)
  LOOP
    INSERT INTO public.griya_therapists (branch_id, therapist_id, discipline, display_order)
    SELECT v_branch, p.id, rec.discipline, rec.ord
    FROM public.internal_profiles p
    WHERE p.branch_id = v_branch
      AND p.is_active = true
      AND (lower(p.nickname) = rec.nick OR lower(p.full_name) LIKE rec.nick || '%')
    ORDER BY (lower(p.nickname) = rec.nick) DESC
    LIMIT 1
    ON CONFLICT (branch_id, therapist_id) DO NOTHING;
  END LOOP;
END $$;

-- ── 3. griya_schedule_slots ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.griya_schedule_slots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  patient_id    uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_id  uuid NOT NULL REFERENCES public.internal_profiles(id),
  discipline    text NOT NULL CHECK (discipline IN ('FISIOTERAPI', 'TERAPI_WICARA', 'TERAPI_PERILAKU', 'PSIKOLOG')),
  hari          varchar NOT NULL CHECK (hari IN ('SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'AHAD')),
  slot_time     time NOT NULL,
  service_type  text,
  package_id    uuid REFERENCES public.patient_packages(id) ON DELETE SET NULL,
  start_date    date NOT NULL DEFAULT CURRENT_DATE,
  end_date      date,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'stopped', 'paused')),
  notes         text,
  created_by    uuid REFERENCES public.internal_profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- At most one active child per therapist cell (therapist + weekday + time).
CREATE UNIQUE INDEX IF NOT EXISTS griya_slot_active_cell_uniq
  ON public.griya_schedule_slots (therapist_id, hari, slot_time)
  WHERE status = 'active' AND end_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_griya_slots_branch_status ON public.griya_schedule_slots (branch_id, status);
CREATE INDEX IF NOT EXISTS idx_griya_slots_patient      ON public.griya_schedule_slots (patient_id);

DROP TRIGGER IF EXISTS griya_schedule_slots_updated_at ON public.griya_schedule_slots;
CREATE TRIGGER griya_schedule_slots_updated_at
  BEFORE UPDATE ON public.griya_schedule_slots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.griya_schedule_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "griya_slots_director_all"
ON public.griya_schedule_slots FOR ALL
USING (get_my_internal_role() = 'director')
WITH CHECK (get_my_internal_role() = 'director');

CREATE POLICY "griya_slots_branch_write"
ON public.griya_schedule_slots FOR ALL
USING (get_my_internal_role() IN ('admin', 'manager') AND branch_id = get_my_branch())
WITH CHECK (get_my_internal_role() IN ('admin', 'manager') AND branch_id = get_my_branch());

CREATE POLICY "griya_slots_branch_read"
ON public.griya_schedule_slots FOR SELECT
USING (branch_id = get_my_branch());

-- ── 4. patient_visits.griya_slot_id ───────────────────────────────────────

ALTER TABLE public.patient_visits
  ADD COLUMN IF NOT EXISTS griya_slot_id uuid REFERENCES public.griya_schedule_slots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patient_visits_griya_slot
  ON public.patient_visits (griya_slot_id) WHERE griya_slot_id IS NOT NULL;

-- One realised session per (slot, date) — lets markAttendance / this-week move
-- upsert on this key.
CREATE UNIQUE INDEX IF NOT EXISTS griya_visit_slot_date_uniq
  ON public.patient_visits (griya_slot_id, visit_date) WHERE griya_slot_id IS NOT NULL;

-- No RLS change: patient_visits already has the role-agnostic "pv: branch staff"
-- policy (branch_id = get_my_branch()) plus "pv: director all".
