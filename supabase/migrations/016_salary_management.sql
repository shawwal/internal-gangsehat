-- ============================================================
-- 016_salary_management.sql
-- Three-table salary system:
--   salary_settings    — global formula per role (director-only writes)
--   employee_salaries  — per-employee overrides (NULL = use role default)
--   payroll_records    — monthly computed payroll (draft → confirmed → paid)
-- ============================================================

-- ── salary_settings ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.salary_settings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role                text NOT NULL UNIQUE,
  base_salary         numeric NOT NULL DEFAULT 0,
  transport_allowance numeric NOT NULL DEFAULT 0,
  meal_allowance      numeric NOT NULL DEFAULT 0,
  bonus_target_pct    numeric NOT NULL DEFAULT 0,  -- % of base as bonus when target 100% met
  updated_by          uuid REFERENCES public.internal_profiles(id) ON DELETE SET NULL,
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE public.salary_settings ENABLE ROW LEVEL SECURITY;

-- Director: full access
CREATE POLICY "ss: director all"
  ON public.salary_settings FOR ALL
  USING  (get_my_internal_role() = 'director')
  WITH CHECK (get_my_internal_role() = 'director');

-- All authenticated users: read
CREATE POLICY "ss: authenticated read"
  ON public.salary_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Seed default rows for every role (all zeros; director fills them in)
INSERT INTO public.salary_settings (role, base_salary, transport_allowance, meal_allowance, bonus_target_pct)
VALUES
  ('director',  0, 0, 0, 0),
  ('manager',   0, 0, 0, 0),
  ('finance',   0, 0, 0, 0),
  ('hr',        0, 0, 0, 0),
  ('marketing', 0, 0, 0, 0),
  ('therapist', 0, 0, 0, 0),
  ('staff',     0, 0, 0, 0)
ON CONFLICT (role) DO NOTHING;

-- ── employee_salaries ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.employee_salaries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id            uuid NOT NULL UNIQUE REFERENCES public.internal_profiles(id) ON DELETE CASCADE,
  base_salary         numeric,            -- NULL = inherit from salary_settings for their role
  transport_allowance numeric,            -- NULL = inherit
  meal_allowance      numeric,            -- NULL = inherit
  other_allowance     numeric NOT NULL DEFAULT 0,
  notes               text,
  updated_by          uuid REFERENCES public.internal_profiles(id) ON DELETE SET NULL,
  updated_at          timestamptz DEFAULT now(),
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE public.employee_salaries ENABLE ROW LEVEL SECURITY;

-- Director: full access to all
CREATE POLICY "es: director all"
  ON public.employee_salaries FOR ALL
  USING  (get_my_internal_role() = 'director')
  WITH CHECK (get_my_internal_role() = 'director');

-- Manager: read own-branch employees only
CREATE POLICY "es: manager branch read"
  ON public.employee_salaries FOR SELECT
  USING (
    get_my_internal_role() = 'manager'
    AND get_my_branch() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.internal_profiles ip
      WHERE ip.id = employee_salaries.staff_id
        AND ip.branch_id = get_my_branch()
    )
  );

-- ── payroll_records ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id            uuid NOT NULL REFERENCES public.internal_profiles(id) ON DELETE CASCADE,
  branch_id           uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  period_month        int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year         int NOT NULL,
  base_salary         numeric NOT NULL DEFAULT 0,
  transport_allowance numeric NOT NULL DEFAULT 0,
  meal_allowance      numeric NOT NULL DEFAULT 0,
  other_allowance     numeric NOT NULL DEFAULT 0,
  bonus_achievement   numeric NOT NULL DEFAULT 0,
  deductions          numeric NOT NULL DEFAULT 0,
  notes               text,
  status              text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'confirmed', 'paid')),
  confirmed_by        uuid REFERENCES public.internal_profiles(id) ON DELETE SET NULL,
  confirmed_at        timestamptz,
  paid_at             timestamptz,
  transaction_id      uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_by          uuid REFERENCES public.internal_profiles(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE (staff_id, period_month, period_year)
);

ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

-- Director: full access
CREATE POLICY "pr: director all"
  ON public.payroll_records FOR ALL
  USING  (get_my_internal_role() = 'director')
  WITH CHECK (get_my_internal_role() = 'director');

-- Manager: all ops on own branch
CREATE POLICY "pr: manager branch"
  ON public.payroll_records FOR ALL
  USING  (get_my_internal_role() = 'manager' AND get_my_branch() IS NOT NULL AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() = 'manager' AND get_my_branch() IS NOT NULL AND branch_id = get_my_branch());

-- ── updated_at triggers ──────────────────────────────────────

-- Reuse set_updated_at() if it already exists (created by earlier migrations).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'salary_settings_updated_at') THEN
    CREATE TRIGGER salary_settings_updated_at
      BEFORE UPDATE ON public.salary_settings
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'employee_salaries_updated_at') THEN
    CREATE TRIGGER employee_salaries_updated_at
      BEFORE UPDATE ON public.employee_salaries
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'payroll_records_updated_at') THEN
    CREATE TRIGGER payroll_records_updated_at
      BEFORE UPDATE ON public.payroll_records
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
