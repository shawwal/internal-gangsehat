-- Migration 018: Patient Packages
-- Adds patient session packages with quota tracking.
-- Patients can have two types:
--   'fixed'    = sessions are pre-booked on specific dates until quota exhausted
--   'flexible' = sessions can be used at any time (drop-in)
-- used_sessions is computed from patient_visits.package_id counts (no counter column).

-- ── Table ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patient_packages (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id      uuid        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  branch_id       uuid        REFERENCES public.branches(id) ON DELETE SET NULL,
  package_name    text        NOT NULL,
  package_type    text        NOT NULL DEFAULT 'flexible'
                              CHECK (package_type IN ('fixed', 'flexible')),
  total_sessions  integer     NOT NULL DEFAULT 1 CHECK (total_sessions > 0),
  notes           text,
  status          text        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'completed', 'cancelled')),
  created_by      uuid        REFERENCES public.internal_profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_patient_packages_patient
  ON public.patient_packages (patient_id, status);

-- ── Link patient_visits to packages (nullable — existing visits unaffected) ───
ALTER TABLE public.patient_visits
  ADD COLUMN IF NOT EXISTS package_id uuid
  REFERENCES public.patient_packages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patient_visits_package
  ON public.patient_visits (package_id)
  WHERE package_id IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.patient_packages ENABLE ROW LEVEL SECURITY;

-- Any authenticated internal staff can read packages
CREATE POLICY "internal staff read patient_packages"
  ON public.patient_packages FOR SELECT
  USING (public.get_my_internal_role() IS NOT NULL);

-- Branch staff (including director with NULL branch) can insert/update/delete
CREATE POLICY "branch staff manage patient_packages"
  ON public.patient_packages FOR ALL
  USING (
    branch_id = public.get_my_branch()
    OR public.get_my_branch() IS NULL
  )
  WITH CHECK (
    branch_id = public.get_my_branch()
    OR public.get_my_branch() IS NULL
  );
