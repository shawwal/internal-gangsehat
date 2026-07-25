-- Migration: rolling shift (Tim A / Tim B, 2-week rotating pattern) — per branch
-- Run this in the Supabase SQL editor.
--
-- Coexists with the flat `schedules` table: a staff member is either on the
-- flat weekly schedule OR on a rolling team, never both (enforced at the app
-- layer in app/actions/rollingShift.ts, not by a DB constraint).
--
-- Minggu (Sunday) is intentionally NOT a stored column on shift_patterns —
-- it is always derived at read time from that week's Sabtu shift
-- (SORE→PAGI, PAGI→SORE) by lib/shift/rollingShift.ts. See the two spec PDFs
-- for the full business rule.

CREATE TABLE public.shift_patterns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   uuid NOT NULL REFERENCES public.branches(id),
  code        text NOT NULL CHECK (code IN ('X', 'Y')),
  name        text,
  senin       text NOT NULL CHECK (senin  IN ('PAGI', 'SORE', 'OFF')),
  selasa      text NOT NULL CHECK (selasa IN ('PAGI', 'SORE', 'OFF')),
  rabu        text NOT NULL CHECK (rabu   IN ('PAGI', 'SORE', 'OFF')),
  kamis       text NOT NULL CHECK (kamis  IN ('PAGI', 'SORE', 'OFF')),
  jumat       text NOT NULL CHECK (jumat  IN ('PAGI', 'SORE', 'OFF')),
  sabtu       text NOT NULL CHECK (sabtu  IN ('PAGI', 'SORE', 'OFF')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, code)
);

CREATE TABLE public.shift_teams (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    uuid NOT NULL REFERENCES public.branches(id),
  name         text NOT NULL CHECK (name IN ('A', 'B')),
  pola_x_id    uuid NOT NULL REFERENCES public.shift_patterns(id),
  pola_y_id    uuid NOT NULL REFERENCES public.shift_patterns(id),
  anchor_date  date NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, name)
);

CREATE TABLE public.shift_team_members (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id              uuid NOT NULL REFERENCES public.shift_teams(id),
  staff_id             uuid NOT NULL REFERENCES public.internal_profiles(id),
  effective_start_date date NOT NULL DEFAULT CURRENT_DATE,
  effective_end_date   date,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT end_after_start CHECK (effective_end_date IS NULL OR effective_end_date >= effective_start_date)
);

-- One active team membership per staff member at a time.
CREATE UNIQUE INDEX shift_team_members_one_active_per_staff
  ON public.shift_team_members (staff_id)
  WHERE effective_end_date IS NULL;

CREATE INDEX idx_shift_team_members_staff_dates
  ON public.shift_team_members (staff_id, effective_start_date, effective_end_date);

ALTER TABLE public.shift_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_team_members ENABLE ROW LEVEL SECURITY;

-- ── shift_patterns ────────────────────────────────────────────────────────
CREATE POLICY "shift_patterns_select_own_branch"
ON public.shift_patterns FOR SELECT
USING (get_my_internal_role() IS NOT NULL AND branch_id = get_my_branch());

CREATE POLICY "shift_patterns_hr_own_branch"
ON public.shift_patterns FOR ALL
USING (get_my_internal_role() = 'hr' AND branch_id = get_my_branch())
WITH CHECK (get_my_internal_role() = 'hr' AND branch_id = get_my_branch());

CREATE POLICY "shift_patterns_director_all"
ON public.shift_patterns FOR ALL
USING (get_my_internal_role() = 'director')
WITH CHECK (get_my_internal_role() = 'director');

-- ── shift_teams ───────────────────────────────────────────────────────────
CREATE POLICY "shift_teams_select_own_branch"
ON public.shift_teams FOR SELECT
USING (get_my_internal_role() IS NOT NULL AND branch_id = get_my_branch());

CREATE POLICY "shift_teams_hr_own_branch"
ON public.shift_teams FOR ALL
USING (get_my_internal_role() = 'hr' AND branch_id = get_my_branch())
WITH CHECK (get_my_internal_role() = 'hr' AND branch_id = get_my_branch());

CREATE POLICY "shift_teams_director_all"
ON public.shift_teams FOR ALL
USING (get_my_internal_role() = 'director')
WITH CHECK (get_my_internal_role() = 'director');

-- ── shift_team_members (no direct branch_id — join through team_id) ───────
CREATE POLICY "stm_select_own_branch"
ON public.shift_team_members FOR SELECT
USING (
  get_my_internal_role() IS NOT NULL
  AND team_id IN (SELECT id FROM public.shift_teams WHERE branch_id = get_my_branch())
);

CREATE POLICY "stm_hr_own_branch"
ON public.shift_team_members FOR ALL
USING (
  get_my_internal_role() = 'hr'
  AND team_id IN (SELECT id FROM public.shift_teams WHERE branch_id = get_my_branch())
)
WITH CHECK (
  get_my_internal_role() = 'hr'
  AND team_id IN (SELECT id FROM public.shift_teams WHERE branch_id = get_my_branch())
);

CREATE POLICY "stm_director_all"
ON public.shift_team_members FOR ALL
USING (get_my_internal_role() = 'director')
WITH CHECK (get_my_internal_role() = 'director');
