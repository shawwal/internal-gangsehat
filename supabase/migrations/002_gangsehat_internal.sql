-- ============================================================
-- Gangsehat Internal System — Migration 002
--
-- Creates all tables for the internal management system.
-- DOES NOT modify: public.profiles, public.patients, or any
-- existing gangsehat.com tables.
-- Internal staff use a separate table: public.internal_profiles
-- ============================================================

-- ── Enum: Internal user roles ────────────────────────────────
DO $$ BEGIN
  CREATE TYPE internal_user_role AS ENUM (
    'director', 'finance', 'hr', 'marketing'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Branches ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.branches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  address    text,
  phone      text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- ── Internal Staff Profiles ──────────────────────────────────
-- Completely separate from gangsehat.com's public.profiles.
-- director: branch_id = NULL  →  all-branch access
-- staff:    branch_id = <id>  →  scoped to one branch
CREATE TABLE IF NOT EXISTS public.internal_profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text NOT NULL DEFAULT '',
  email      text NOT NULL DEFAULT '',
  phone      text,
  role       internal_user_role NOT NULL DEFAULT 'marketing',
  branch_id  uuid REFERENCES public.branches(id),
  avatar_url text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.internal_profiles ENABLE ROW LEVEL SECURITY;

-- ── Patient Visits ───────────────────────────────────────────
-- References existing gangsehat.com public.patients by id only.
-- No FK defined to avoid coupling to gangsehat.com schema changes.
CREATE TABLE IF NOT EXISTS public.patient_visits (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id         uuid NOT NULL,          -- loosely refs public.patients
  branch_id          uuid NOT NULL REFERENCES public.branches(id),
  visit_date         date NOT NULL DEFAULT CURRENT_DATE,
  chief_complaint    text,
  diagnosis          text,
  treatment          text,
  attending_staff_id uuid REFERENCES public.internal_profiles(id),
  status             text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  notes              text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

ALTER TABLE public.patient_visits ENABLE ROW LEVEL SECURITY;

-- ── Financial Transactions ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        uuid NOT NULL REFERENCES public.branches(id),
  patient_id       uuid,                     -- loosely refs public.patients
  visit_id         uuid REFERENCES public.patient_visits(id),
  type             text NOT NULL CHECK (type IN ('income','expense')),
  category         text NOT NULL,
  amount           numeric NOT NULL,
  description      text,
  receipt_url      text,
  status           text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','rejected')),
  rejection_reason text,
  recorded_by      uuid REFERENCES public.internal_profiles(id),
  confirmed_by     uuid REFERENCES public.internal_profiles(id),
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- ── Branch Financial Reports ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.branch_financial_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     uuid NOT NULL REFERENCES public.branches(id),
  period_year   integer NOT NULL,
  period_month  integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  total_income  numeric NOT NULL DEFAULT 0,
  total_expense numeric NOT NULL DEFAULT 0,
  net_profit    numeric GENERATED ALWAYS AS (total_income - total_expense) STORED,
  patient_count integer NOT NULL DEFAULT 0,
  visit_count   integer NOT NULL DEFAULT 0,
  submitted_by  uuid REFERENCES public.internal_profiles(id),
  submitted_at  timestamptz,
  reviewed_by   uuid REFERENCES public.internal_profiles(id),
  reviewed_at   timestamptz,
  status        text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved','rejected')),
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (branch_id, period_year, period_month)
);

ALTER TABLE public.branch_financial_reports ENABLE ROW LEVEL SECURITY;

-- ── Staff Attendance ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    uuid NOT NULL REFERENCES public.internal_profiles(id),
  branch_id   uuid NOT NULL REFERENCES public.branches(id),
  date        date NOT NULL DEFAULT CURRENT_DATE,
  check_in    timestamptz,
  check_out   timestamptz,
  status      text NOT NULL DEFAULT 'present'
    CHECK (status IN ('present','absent','late','leave','sick')),
  notes       text,
  recorded_by uuid REFERENCES public.internal_profiles(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (staff_id, date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- ── Leave Requests ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        uuid NOT NULL REFERENCES public.internal_profiles(id),
  branch_id       uuid NOT NULL REFERENCES public.branches(id),
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  reason          text NOT NULL,
  proof_url       text,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  reviewed_by     uuid REFERENCES public.internal_profiles(id),
  reviewed_at     timestamptz,
  rejection_note  text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- ── Marketing Campaigns ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaigns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    uuid NOT NULL REFERENCES public.branches(id),
  title        text NOT NULL,
  description  text,
  channel      text CHECK (channel IN ('social_media','whatsapp','email','flyer','other')),
  start_date   date,
  end_date     date,
  budget       numeric DEFAULT 0,
  actual_spend numeric DEFAULT 0,
  target_reach integer,
  actual_reach integer,
  status       text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','completed','cancelled')),
  created_by   uuid REFERENCES public.internal_profiles(id),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- ── In-App Notifications ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.internal_profiles(id),
  target_role internal_user_role,
  title       text NOT NULL,
  message     text,
  link        text,
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- ── Helper Functions ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_internal_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role::text FROM public.internal_profiles WHERE id = auth.uid();
$$;

-- Returns NULL for director (no branch restriction)
CREATE OR REPLACE FUNCTION get_my_branch()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT branch_id FROM public.internal_profiles WHERE id = auth.uid();
$$;

-- ── RLS: branches ────────────────────────────────────────────
DROP POLICY IF EXISTS "branches: director manages" ON public.branches;
CREATE POLICY "branches: director manages"
  ON public.branches FOR ALL
  USING (get_my_internal_role() = 'director')
  WITH CHECK (get_my_internal_role() = 'director');

DROP POLICY IF EXISTS "branches: staff reads" ON public.branches;
CREATE POLICY "branches: staff reads"
  ON public.branches FOR SELECT
  USING (id = get_my_branch() OR get_my_internal_role() = 'director');

-- ── RLS: internal_profiles ───────────────────────────────────
DROP POLICY IF EXISTS "ip: own read"       ON public.internal_profiles;
DROP POLICY IF EXISTS "ip: own update"     ON public.internal_profiles;
DROP POLICY IF EXISTS "ip: own insert"     ON public.internal_profiles;
DROP POLICY IF EXISTS "ip: director all"   ON public.internal_profiles;
DROP POLICY IF EXISTS "ip: hr reads branch" ON public.internal_profiles;

CREATE POLICY "ip: own read"
  ON public.internal_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "ip: own update"
  ON public.internal_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    role = (SELECT p.role FROM public.internal_profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "ip: own insert"
  ON public.internal_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "ip: director all"
  ON public.internal_profiles FOR ALL
  USING (get_my_internal_role() = 'director')
  WITH CHECK (get_my_internal_role() = 'director');

CREATE POLICY "ip: hr reads branch"
  ON public.internal_profiles FOR SELECT
  USING (get_my_internal_role() = 'hr' AND branch_id = get_my_branch());

-- ── RLS: patient_visits ──────────────────────────────────────
DROP POLICY IF EXISTS "pv: director all"    ON public.patient_visits;
DROP POLICY IF EXISTS "pv: branch staff"    ON public.patient_visits;

CREATE POLICY "pv: director all"
  ON public.patient_visits FOR ALL
  USING (get_my_internal_role() = 'director')
  WITH CHECK (get_my_internal_role() = 'director');

CREATE POLICY "pv: branch staff"
  ON public.patient_visits FOR ALL
  USING (branch_id = get_my_branch())
  WITH CHECK (branch_id = get_my_branch());

-- ── RLS: transactions ────────────────────────────────────────
DROP POLICY IF EXISTS "tx: director all"    ON public.transactions;
DROP POLICY IF EXISTS "tx: finance branch"  ON public.transactions;

CREATE POLICY "tx: director all"
  ON public.transactions FOR ALL
  USING (get_my_internal_role() = 'director')
  WITH CHECK (get_my_internal_role() = 'director');

CREATE POLICY "tx: finance branch"
  ON public.transactions FOR ALL
  USING (get_my_internal_role() = 'finance' AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() = 'finance' AND branch_id = get_my_branch());

-- ── RLS: branch_financial_reports ───────────────────────────
DROP POLICY IF EXISTS "bfr: director all"   ON public.branch_financial_reports;
DROP POLICY IF EXISTS "bfr: finance branch" ON public.branch_financial_reports;

CREATE POLICY "bfr: director all"
  ON public.branch_financial_reports FOR ALL
  USING (get_my_internal_role() = 'director')
  WITH CHECK (get_my_internal_role() = 'director');

CREATE POLICY "bfr: finance branch"
  ON public.branch_financial_reports FOR ALL
  USING (get_my_internal_role() = 'finance' AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() = 'finance' AND branch_id = get_my_branch());

-- ── RLS: attendance ──────────────────────────────────────────
DROP POLICY IF EXISTS "att: director all"   ON public.attendance;
DROP POLICY IF EXISTS "att: hr branch"      ON public.attendance;
DROP POLICY IF EXISTS "att: own read"       ON public.attendance;

CREATE POLICY "att: director all"
  ON public.attendance FOR ALL
  USING (get_my_internal_role() = 'director')
  WITH CHECK (get_my_internal_role() = 'director');

CREATE POLICY "att: hr branch"
  ON public.attendance FOR ALL
  USING (get_my_internal_role() = 'hr' AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() = 'hr' AND branch_id = get_my_branch());

CREATE POLICY "att: own read"
  ON public.attendance FOR SELECT
  USING (staff_id = auth.uid());

-- ── RLS: leave_requests ──────────────────────────────────────
DROP POLICY IF EXISTS "lr: own"            ON public.leave_requests;
DROP POLICY IF EXISTS "lr: hr branch"      ON public.leave_requests;
DROP POLICY IF EXISTS "lr: director all"   ON public.leave_requests;

CREATE POLICY "lr: own"
  ON public.leave_requests FOR ALL
  USING (staff_id = auth.uid())
  WITH CHECK (staff_id = auth.uid());

CREATE POLICY "lr: hr branch"
  ON public.leave_requests FOR ALL
  USING (get_my_internal_role() = 'hr' AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() = 'hr' AND branch_id = get_my_branch());

CREATE POLICY "lr: director all"
  ON public.leave_requests FOR ALL
  USING (get_my_internal_role() = 'director')
  WITH CHECK (get_my_internal_role() = 'director');

-- ── RLS: campaigns ───────────────────────────────────────────
DROP POLICY IF EXISTS "camp: director all"    ON public.campaigns;
DROP POLICY IF EXISTS "camp: marketing branch" ON public.campaigns;

CREATE POLICY "camp: director all"
  ON public.campaigns FOR ALL
  USING (get_my_internal_role() = 'director')
  WITH CHECK (get_my_internal_role() = 'director');

CREATE POLICY "camp: marketing branch"
  ON public.campaigns FOR ALL
  USING (get_my_internal_role() = 'marketing' AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() = 'marketing' AND branch_id = get_my_branch());

-- ── RLS: user_notifications ──────────────────────────────────
DROP POLICY IF EXISTS "notif: own"       ON public.user_notifications;
DROP POLICY IF EXISTS "notif: by role"   ON public.user_notifications;

CREATE POLICY "notif: own"
  ON public.user_notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notif: by role"
  ON public.user_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.internal_profiles ip
      WHERE ip.id = auth.uid()
        AND ip.role::text = target_role::text
    )
  );

-- ── Trigger: auto-create internal_profile on new user signup ─
-- Every new Supabase Auth user gets a default internal_profile.
-- Director assigns the correct role + branch via Staff management.
CREATE OR REPLACE FUNCTION handle_new_internal_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.internal_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(COALESCE(NEW.email, 'user@x'), '@', 1)
    ),
    'marketing'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_internal ON auth.users;
CREATE TRIGGER on_auth_user_created_internal
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_internal_user();

-- ── Back-fill: create internal_profiles for existing auth users
-- that don't have one yet (runs once, safe to re-run)
INSERT INTO public.internal_profiles (id, email, full_name, role)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    split_part(COALESCE(u.email, 'user@x'), '@', 1)
  ),
  'marketing'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.internal_profiles ip WHERE ip.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- ── Seed: branches ───────────────────────────────────────────
INSERT INTO public.branches (name, address, is_active) VALUES
  ('Fisioterapi Gang Sehat Pontianak',  'Jl. Kesehatan Gg. Kesehatan Dalam No. 4, Pontianak',                     true),
  ('Griya Anak Gang Sehat',             'Jl. Kesehatan No. 12A, Pontianak',                                       true),
  ('Fisioterapi Gang Sehat Singkawang', 'Jl. Gunung Bawang No. 72, Singkawang',                                   true),
  ('Nafaya Centre',                     'Jl. Manarap Handil Bakumpai Perumahan Griya Surya Jaya 2 No. 13B, Banjar', false)
ON CONFLICT DO NOTHING;
