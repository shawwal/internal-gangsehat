-- Migration 095: Payroll engine (replaces the manual payroll_records flow).
--
-- Mirrors the legacy "Penggajian" workbook (reference/1.1 …xlsx):
--   ID       → employee_payroll_profiles + employee_compensation (versioned)
--   TEMP     → payroll_periods.days (generated 27th → 26th calendar, workday flags)
--   ABS      → attendance (extended: 'izin' status + late_minutes)
--   AUTO INS → payroll_activity_counts (auto-fetched from patient_visits, HR override)
--   INS      → computed by lib/payroll/engine.ts from compensation + activity counts
--   DENDA    → payroll_adjustments (debit fines AND credit bonuses)
--   GAJI     → computed live; frozen into payroll_slips on lock
--   SLIP     → payroll_slips rendered to PDF client-side (zero lines omitted)
--
-- Every money figure and rule (late fine per minute, alfa fine, operasional
-- threshold, incentive targets, visit rates, rounding) lives in a table here —
-- nothing is hardcoded in application code.
--
-- Workflow: draft → submitted (HR) → locked (director/manager approve) → paid (finance).
-- Locked/paid periods reject writes to their inputs (and to attendance rows in
-- their date range) at the database level.
--
-- Run this in the Supabase SQL editor.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Attendance: ABS sheet codes H / <minutes late> / I / S / C / A
--    H → present · number → late + late_minutes · I → izin (new)
--    S → sick · C → leave (paid leave) · A → absent (alfa)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'absent', 'late', 'leave', 'sick', 'izin'));

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS late_minutes int NOT NULL DEFAULT 0;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_late_minutes_check;
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_late_minutes_check CHECK (late_minutes BETWEEN 0 AND 600);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Configuration tables
-- ─────────────────────────────────────────────────────────────────────────────

-- One row per branch, plus an optional global row (branch_id NULL) used as the
-- fallback for branches without their own row.
CREATE TABLE IF NOT EXISTS public.payroll_settings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id         uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  period_start_day  int  NOT NULL DEFAULT 27 CHECK (period_start_day BETWEEN 1 AND 31),
  weekly_off_days   text[] NOT NULL DEFAULT ARRAY['JUMAT'],
  rounding_unit     int  NOT NULL DEFAULT 1000 CHECK (rounding_unit >= 1),
  -- validation thresholds (inline warnings, not hard limits)
  max_late_days_warning int NOT NULL DEFAULT 4,
  -- payslip header
  clinic_name       text NOT NULL DEFAULT 'Fisioterapi Gang Sehat',
  clinic_address    text NOT NULL DEFAULT 'Jl. Kesehatan Gg. Kesehatan Dalam No. 4, Pontianak, Kalimantan Barat 78115',
  clinic_contact    text NOT NULL DEFAULT '+62 813-4611-1417 / fisio.ggsehat@gmail.com',
  updated_by        uuid REFERENCES public.internal_profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_settings_branch
  ON public.payroll_settings (COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid));

INSERT INTO public.payroll_settings (branch_id)
SELECT NULL WHERE NOT EXISTS (SELECT 1 FROM public.payroll_settings WHERE branch_id IS NULL);

-- Attendance penalty rules. Fixed amount per unit, or a percentage of
-- GAJI POKOK per unit. Branch rows override the global row with the same code.
CREATE TABLE IF NOT EXISTS public.payroll_deduction_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  code        text NOT NULL,
  label       text NOT NULL,                       -- shown on the payslip
  basis       text NOT NULL CHECK (basis IN ('late_minutes', 'late_days', 'alfa_days', 'izin_days', 'sakit_days')),
  calc_type   text NOT NULL DEFAULT 'fixed' CHECK (calc_type IN ('fixed', 'percent_base')),
  amount      numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  is_active   bool NOT NULL DEFAULT true,
  sort_order  int  NOT NULL DEFAULT 0,
  updated_by  uuid REFERENCES public.internal_profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_deduction_rules_code
  ON public.payroll_deduction_rules (COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

INSERT INTO public.payroll_deduction_rules (branch_id, code, label, basis, calc_type, amount, sort_order)
SELECT NULL, v.code, v.label, v.basis, 'fixed', v.amount, v.sort_order
FROM (VALUES
  ('LATE', 'Terlambat',   'late_minutes', 5000,   1),   -- ABS!AS = TLBT × 5.000
  ('ALFA', 'Tidak absen', 'alfa_days',    100000, 2)    -- ABS!AT = ALFA × 100.000
) AS v(code, label, basis, amount, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.payroll_deduction_rules r WHERE r.branch_id IS NULL AND r.code = v.code
);

-- Non-working days. branch_id NULL = applies to every branch (national holiday).
CREATE TABLE IF NOT EXISTS public.payroll_holidays (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  date        date NOT NULL,
  name        text NOT NULL,
  created_by  uuid REFERENCES public.internal_profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_holidays
  ON public.payroll_holidays (COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), date);

-- Billable activity catalogue (AUTO INS columns). count_mode:
--   session → one per attended visit · package → one per package (first attended
--   session) · manual → HR enters the number (e.g. content count, distance visits)
CREATE TABLE IF NOT EXISTS public.payroll_activity_types (
  code                  text PRIMARY KEY,
  label                 text NOT NULL,
  group_label           text NOT NULL,
  count_mode            text NOT NULL DEFAULT 'manual' CHECK (count_mode IN ('session', 'package', 'manual')),
  source_service_types  text[] NOT NULL DEFAULT '{}',
  source_layanan_ids    uuid[] NOT NULL DEFAULT '{}',
  max_per_period        int  NOT NULL DEFAULT 200 CHECK (max_per_period > 0),
  sort_order            int  NOT NULL DEFAULT 0,
  is_active             bool NOT NULL DEFAULT true,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.payroll_activity_types (code, label, group_label, count_mode, source_service_types, max_per_period, sort_order) VALUES
  ('KLINIK_PT',        'PT (Paket Terapi)',     'Klinik FT', 'session', ARRAY['PAKET TERAPI'], 150, 10),
  ('KLINIK_ST',        'ST (Sesi Terapi)',      'Klinik FT', 'session', ARRAY['SESI TERAPI'],  100, 11),
  ('KLINIK_TA',        'TA (Terapi Awal)',      'Klinik FT', 'session', ARRAY['TERAPI AWAL'],  100, 12),
  ('SM_FB',            'FB (Sport Massage)',    'Klinik SM', 'manual',  ARRAY[]::text[],       150, 20),
  ('SM_SG',            'SG (Sport Massage)',    'Klinik SM', 'manual',  ARRAY[]::text[],       150, 21),
  ('VISIT_PT',         'PT Visit (Paket)',      'Visit FT',  'package', ARRAY['PAKET VISIT'],  20,  30),
  ('VISIT_ST',         'ST Visit (Sesi)',       'Visit FT',  'session', ARRAY['SESI VISIT'],   40,  31),
  ('VISIT_TA',         'TA Visit',              'Visit FT',  'session', ARRAY['TA VISIT'],     40,  32),
  ('VISIT_JARAK',      'Jarak Visit FT',        'Visit FT',  'manual',  ARRAY[]::text[],       60,  33),
  ('VISIT_SM_FB',      'FB Visit SM',           'Visit SM',  'manual',  ARRAY[]::text[],       40,  40),
  ('VISIT_SM_SG',      'SG Visit SM',           'Visit SM',  'manual',  ARRAY[]::text[],       40,  41),
  ('VISIT_SM_PAKET_FB','Paket FB Visit SM',     'Visit SM',  'manual',  ARRAY[]::text[],       20,  42),
  ('VISIT_SM_PAKET_SG','Paket SG Visit SM',     'Visit SM',  'manual',  ARRAY[]::text[],       20,  43),
  ('VISIT_SM_JARAK',   'Jarak Visit SM',        'Visit SM',  'manual',  ARRAY[]::text[],       60,  44),
  ('ADMIN_TA',         'TA Diinput (Admin)',    'Lainnya',   'manual',  ARRAY[]::text[],       400, 50),
  ('KONTEN',           'Jumlah Konten',         'Lainnya',   'manual',  ARRAY[]::text[],       100, 51)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Employees & compensation history
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_payroll_profiles (
  staff_id            uuid PRIMARY KEY REFERENCES public.internal_profiles(id) ON DELETE CASCADE,
  employee_no         text UNIQUE,                    -- NO. KARYAWAN, e.g. B1220101
  jabatan             text,                           -- FISIOTERAPIS, STAF ADMINISTRASI, MASSEUR …
  hire_date           date,
  termination_date    date,
  include_in_payroll  bool NOT NULL DEFAULT true,
  updated_by          uuid REFERENCES public.internal_profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Insert-only version history: a change of GAJI POKOK or a rate is a new row
-- with a later effective_from, so past periods still resolve to the old values.
CREATE TABLE IF NOT EXISTS public.employee_compensation (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id                  uuid NOT NULL REFERENCES public.internal_profiles(id) ON DELETE CASCADE,
  effective_from            date NOT NULL,
  gaji_pokok                numeric NOT NULL DEFAULT 0 CHECK (gaji_pokok >= 0),
  tj_jabatan                numeric NOT NULL DEFAULT 0 CHECK (tj_jabatan >= 0),
  operasional               numeric NOT NULL DEFAULT 0 CHECK (operasional >= 0),
  -- prorata: floor(ratio × operasional) unless ratio ≤ threshold (then 0)
  -- daily_deduction: (hadir + cuti − workdays) × daily rate (masseur rule)
  operasional_mode          text NOT NULL DEFAULT 'prorata' CHECK (operasional_mode IN ('prorata', 'daily_deduction', 'none')),
  operasional_threshold     numeric NOT NULL DEFAULT 0.75 CHECK (operasional_threshold BETWEEN 0 AND 1),
  operasional_daily_rate    numeric NOT NULL DEFAULT 100000 CHECK (operasional_daily_rate >= 0),
  insentif_base             numeric NOT NULL DEFAULT 0 CHECK (insentif_base >= 0),
  incentive_target          int     NOT NULL DEFAULT 0 CHECK (incentive_target >= 0),
  incentive_activity_codes  text[]  NOT NULL DEFAULT '{}',
  bonus_tiers               jsonb   NOT NULL DEFAULT '[]'::jsonb,   -- [{ "min_qty": 40, "amount": 200000, "label": "Bonus Insentif 1" }]
  activity_rates            jsonb   NOT NULL DEFAULT '{}'::jsonb,   -- { "VISIT_PT": 900000, "VISIT_TA": 150000, … }
  notes                     text,
  created_by                uuid REFERENCES public.internal_profiles(id),
  created_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, effective_from)
);
CREATE INDEX IF NOT EXISTS idx_employee_compensation_staff ON public.employee_compensation (staff_id, effective_from DESC);

-- Carry existing per-employee salary overrides over from the old payroll so no
-- configured amount is lost. transport + meal → OPERASIONAL, other → TJ. JABATAN.
INSERT INTO public.employee_compensation (staff_id, effective_from, gaji_pokok, tj_jabatan, operasional, notes)
SELECT es.staff_id,
       DATE '2000-01-01',
       COALESCE(es.base_salary, ss.base_salary, 0),
       COALESCE(es.other_allowance, 0),
       COALESCE(es.transport_allowance, ss.transport_allowance, 0) + COALESCE(es.meal_allowance, ss.meal_allowance, 0),
       'Dipindahkan dari pengaturan gaji lama'
FROM public.employee_salaries es
JOIN public.internal_profiles ip ON ip.id = es.staff_id
LEFT JOIN public.salary_settings ss ON ss.role = ip.role::text
ON CONFLICT (staff_id, effective_from) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Periods and their inputs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id         uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  period_year       int  NOT NULL,
  period_month      int  NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  start_date        date NOT NULL,
  end_date          date NOT NULL,
  days              jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ "date": "2026-08-27", "workday": true, "note": null }]
  workdays          int  NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'locked', 'paid')),
  settings_snapshot jsonb,                                -- rules/settings frozen at lock
  submitted_by      uuid REFERENCES public.internal_profiles(id),
  submitted_at      timestamptz,
  locked_by         uuid REFERENCES public.internal_profiles(id),
  locked_at         timestamptz,
  paid_by           uuid REFERENCES public.internal_profiles(id),
  paid_at           timestamptz,
  expense_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  unlock_reason     text,
  created_by        uuid REFERENCES public.internal_profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, period_year, period_month),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.payroll_period_staff (
  period_id   uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  staff_id    uuid NOT NULL REFERENCES public.internal_profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (period_id, staff_id)
);

CREATE TABLE IF NOT EXISTS public.payroll_activity_counts (
  period_id     uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  staff_id      uuid NOT NULL REFERENCES public.internal_profiles(id) ON DELETE CASCADE,
  activity_code text NOT NULL REFERENCES public.payroll_activity_types(code) ON UPDATE CASCADE,
  auto_qty      numeric NOT NULL DEFAULT 0 CHECK (auto_qty >= 0),
  override_qty  numeric CHECK (override_qty >= 0),
  note          text,
  updated_by    uuid REFERENCES public.internal_profiles(id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (period_id, staff_id, activity_code)
);

CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id     uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  staff_id      uuid NOT NULL REFERENCES public.internal_profiles(id) ON DELETE CASCADE,
  direction     text NOT NULL CHECK (direction IN ('debit', 'credit')),
  category      text NOT NULL CHECK (category IN ('DENDA', 'BONUS', 'KOREKSI', 'LAINNYA')),
  amount        numeric NOT NULL CHECK (amount > 0),
  keterangan    text NOT NULL,          -- shown on the payslip
  internal_note text,                   -- audit note, never on the payslip
  created_by    uuid REFERENCES public.internal_profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_period ON public.payroll_adjustments (period_id, staff_id);

-- Immutable result rows written when a period is locked. Everything the payslip
-- needs is denormalised here so it renders identically forever.
CREATE TABLE IF NOT EXISTS public.payroll_slips (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id           uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  -- SET NULL: a slip is a financial record and outlives the staff account
  -- (name/number are denormalised below).
  staff_id            uuid REFERENCES public.internal_profiles(id) ON DELETE SET NULL,
  branch_id           uuid NOT NULL REFERENCES public.branches(id),
  period_year         int  NOT NULL,
  period_month        int  NOT NULL,
  start_date          date NOT NULL,
  end_date            date NOT NULL,
  employee_no         text,
  full_name           text NOT NULL,
  jabatan             text,
  compensation        jsonb NOT NULL,
  attendance_summary  jsonb NOT NULL,
  activity            jsonb NOT NULL,
  lines               jsonb NOT NULL,     -- [{ code, label, kind: earning|deduction, amount, detail }]
  notes               text,
  gross               numeric NOT NULL,
  total_deductions    numeric NOT NULL,
  net                 numeric NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, staff_id)
);
CREATE INDEX IF NOT EXISTS idx_payroll_slips_staff ON public.payroll_slips (staff_id, period_year DESC, period_month DESC);

-- updated_at triggers
DROP TRIGGER IF EXISTS payroll_settings_updated_at ON public.payroll_settings;
CREATE TRIGGER payroll_settings_updated_at BEFORE UPDATE ON public.payroll_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS payroll_deduction_rules_updated_at ON public.payroll_deduction_rules;
CREATE TRIGGER payroll_deduction_rules_updated_at BEFORE UPDATE ON public.payroll_deduction_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS payroll_activity_types_updated_at ON public.payroll_activity_types;
CREATE TRIGGER payroll_activity_types_updated_at BEFORE UPDATE ON public.payroll_activity_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS employee_payroll_profiles_updated_at ON public.employee_payroll_profiles;
CREATE TRIGGER employee_payroll_profiles_updated_at BEFORE UPDATE ON public.employee_payroll_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS payroll_periods_updated_at ON public.payroll_periods;
CREATE TRIGGER payroll_periods_updated_at BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS payroll_activity_counts_updated_at ON public.payroll_activity_counts;
CREATE TRIGGER payroll_activity_counts_updated_at BEFORE UPDATE ON public.payroll_activity_counts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS payroll_adjustments_updated_at ON public.payroll_adjustments;
CREATE TRIGGER payroll_adjustments_updated_at BEFORE UPDATE ON public.payroll_adjustments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Integrity guards
-- ─────────────────────────────────────────────────────────────────────────────

-- SECURITY DEFINER helpers so RLS policies can resolve a period's branch
-- without recursive policy evaluation.
CREATE OR REPLACE FUNCTION public.payroll_period_branch(p_period_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.payroll_periods WHERE id = p_period_id;
$$;

CREATE OR REPLACE FUNCTION public.payroll_period_is_open(p_period_id uuid)
RETURNS bool LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT status IN ('draft', 'submitted') FROM public.payroll_periods WHERE id = p_period_id), false);
$$;

-- Inputs of a locked/paid period are read-only. auth.uid() IS NULL means the
-- service role (permanent staff deletion, maintenance scripts) — trusted.
CREATE OR REPLACE FUNCTION public.payroll_block_locked_inputs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') AND NOT public.payroll_period_is_open(OLD.period_id) THEN
    RAISE EXCEPTION 'Periode penggajian sudah dikunci — buka kunci dulu untuk mengubah data.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NOT public.payroll_period_is_open(NEW.period_id) THEN
    RAISE EXCEPTION 'Periode penggajian sudah dikunci — buka kunci dulu untuk mengubah data.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS payroll_activity_counts_lock ON public.payroll_activity_counts;
CREATE TRIGGER payroll_activity_counts_lock BEFORE INSERT OR UPDATE OR DELETE ON public.payroll_activity_counts
  FOR EACH ROW EXECUTE FUNCTION public.payroll_block_locked_inputs();
DROP TRIGGER IF EXISTS payroll_adjustments_lock ON public.payroll_adjustments;
CREATE TRIGGER payroll_adjustments_lock BEFORE INSERT OR UPDATE OR DELETE ON public.payroll_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.payroll_block_locked_inputs();
DROP TRIGGER IF EXISTS payroll_period_staff_lock ON public.payroll_period_staff;
CREATE TRIGGER payroll_period_staff_lock BEFORE INSERT OR UPDATE OR DELETE ON public.payroll_period_staff
  FOR EACH ROW EXECUTE FUNCTION public.payroll_block_locked_inputs();

-- Attendance rows inside a locked/paid period of the same branch are read-only.
CREATE OR REPLACE FUNCTION public.payroll_block_locked_attendance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') AND EXISTS (
    SELECT 1 FROM public.payroll_periods p
    WHERE p.branch_id = OLD.branch_id AND OLD.date BETWEEN p.start_date AND p.end_date
      AND p.status IN ('locked', 'paid')
  ) THEN
    RAISE EXCEPTION 'Absensi tanggal % sudah masuk periode penggajian yang dikunci.', OLD.date
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND EXISTS (
    SELECT 1 FROM public.payroll_periods p
    WHERE p.branch_id = NEW.branch_id AND NEW.date BETWEEN p.start_date AND p.end_date
      AND p.status IN ('locked', 'paid')
  ) THEN
    RAISE EXCEPTION 'Absensi tanggal % sudah masuk periode penggajian yang dikunci.', NEW.date
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS attendance_payroll_lock ON public.attendance;
CREATE TRIGGER attendance_payroll_lock BEFORE INSERT OR UPDATE OR DELETE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.payroll_block_locked_attendance();

-- Status transitions: only director/manager may lock or unlock; only
-- director/finance/manager may mark paid. HR may submit and pull back.
CREATE OR REPLACE FUNCTION public.payroll_guard_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text := public.get_my_internal_role();
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'locked' AND OLD.status IN ('draft', 'submitted')
       AND v_role NOT IN ('director', 'manager') THEN
      RAISE EXCEPTION 'Hanya direktur/manajer yang dapat menyetujui & mengunci periode.';
    END IF;
    IF OLD.status IN ('locked', 'paid') AND NEW.status IN ('draft', 'submitted')
       AND v_role NOT IN ('director', 'manager') THEN
      RAISE EXCEPTION 'Hanya direktur/manajer yang dapat membuka kunci periode.';
    END IF;
    IF NEW.status = 'paid' AND v_role NOT IN ('director', 'manager', 'finance') THEN
      RAISE EXCEPTION 'Hanya keuangan/direktur yang dapat menandai periode sudah dibayar.';
    END IF;
    IF NEW.status = 'paid' AND OLD.status <> 'locked' THEN
      RAISE EXCEPTION 'Periode harus dikunci sebelum ditandai dibayar.';
    END IF;
  ELSIF OLD.status IN ('locked', 'paid') AND (
        NEW.days IS DISTINCT FROM OLD.days OR NEW.workdays IS DISTINCT FROM OLD.workdays
     OR NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.end_date IS DISTINCT FROM OLD.end_date) THEN
    RAISE EXCEPTION 'Kalender periode yang sudah dikunci tidak dapat diubah.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS payroll_periods_guard_status ON public.payroll_periods;
CREATE TRIGGER payroll_periods_guard_status BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.payroll_guard_status();

-- Slips are write-once: no updates; deletes only while the period is open again (unlock).
CREATE OR REPLACE FUNCTION public.payroll_slips_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Only allowed change: the staff link being cleared by ON DELETE SET NULL.
    IF NEW.staff_id IS NULL AND (to_jsonb(NEW) - 'staff_id') = (to_jsonb(OLD) - 'staff_id') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Slip gaji bersifat permanen dan tidak dapat diubah.';
  END IF;
  IF NOT public.payroll_period_is_open(OLD.period_id) THEN
    RAISE EXCEPTION 'Slip gaji hanya dapat dihapus setelah periode dibuka kembali.';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS payroll_slips_immutable ON public.payroll_slips;
CREATE TRIGGER payroll_slips_immutable BEFORE UPDATE OR DELETE ON public.payroll_slips
  FOR EACH ROW EXECUTE FUNCTION public.payroll_slips_immutable();

-- Compensation history is append-only (corrections = a new version).
CREATE OR REPLACE FUNCTION public.employee_compensation_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Riwayat kompensasi tidak dapat diubah — tambahkan versi baru dengan tanggal berlaku.';
END $$;

DROP TRIGGER IF EXISTS employee_compensation_append_only ON public.employee_compensation;
CREATE TRIGGER employee_compensation_append_only BEFORE UPDATE ON public.employee_compensation
  FOR EACH ROW EXECUTE FUNCTION public.employee_compensation_append_only();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.payroll_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_deduction_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_holidays          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_activity_types    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_payroll_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_compensation     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_period_staff      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_activity_counts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_adjustments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_slips             ENABLE ROW LEVEL SECURITY;

-- Config: payroll roles read; director writes everything; hr/manager write
-- their own branch's rows (global rows stay director-only).
CREATE POLICY "payroll_settings_read" ON public.payroll_settings FOR SELECT
  USING (get_my_internal_role() IN ('director', 'hr', 'manager', 'finance'));
CREATE POLICY "payroll_settings_director" ON public.payroll_settings FOR ALL
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');
CREATE POLICY "payroll_settings_branch" ON public.payroll_settings FOR ALL
  USING (get_my_internal_role() IN ('hr', 'manager') AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() IN ('hr', 'manager') AND branch_id = get_my_branch());

CREATE POLICY "payroll_deduction_rules_read" ON public.payroll_deduction_rules FOR SELECT
  USING (get_my_internal_role() IN ('director', 'hr', 'manager', 'finance'));
CREATE POLICY "payroll_deduction_rules_director" ON public.payroll_deduction_rules FOR ALL
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');
CREATE POLICY "payroll_deduction_rules_branch" ON public.payroll_deduction_rules FOR ALL
  USING (get_my_internal_role() IN ('hr', 'manager') AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() IN ('hr', 'manager') AND branch_id = get_my_branch());

CREATE POLICY "payroll_holidays_read" ON public.payroll_holidays FOR SELECT
  USING (get_my_internal_role() IN ('director', 'hr', 'manager', 'finance'));
CREATE POLICY "payroll_holidays_director" ON public.payroll_holidays FOR ALL
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');
CREATE POLICY "payroll_holidays_branch" ON public.payroll_holidays FOR ALL
  USING (get_my_internal_role() IN ('hr', 'manager') AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() IN ('hr', 'manager') AND branch_id = get_my_branch());

CREATE POLICY "payroll_activity_types_read" ON public.payroll_activity_types FOR SELECT
  USING (get_my_internal_role() IN ('director', 'hr', 'manager', 'finance'));
CREATE POLICY "payroll_activity_types_director" ON public.payroll_activity_types FOR ALL
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');

-- Employees: director all; hr/manager for staff of their branch; staff read own.
CREATE POLICY "employee_payroll_profiles_director" ON public.employee_payroll_profiles FOR ALL
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');
CREATE POLICY "employee_payroll_profiles_branch" ON public.employee_payroll_profiles FOR ALL
  USING (get_my_internal_role() IN ('hr', 'manager')
         AND staff_id IN (SELECT id FROM public.internal_profiles WHERE branch_id = get_my_branch()))
  WITH CHECK (get_my_internal_role() IN ('hr', 'manager')
         AND staff_id IN (SELECT id FROM public.internal_profiles WHERE branch_id = get_my_branch()));
CREATE POLICY "employee_payroll_profiles_finance_read" ON public.employee_payroll_profiles FOR SELECT
  USING (get_my_internal_role() = 'finance'
         AND staff_id IN (SELECT id FROM public.internal_profiles WHERE branch_id = get_my_branch()));
CREATE POLICY "employee_payroll_profiles_self" ON public.employee_payroll_profiles FOR SELECT
  USING (staff_id = auth.uid());

CREATE POLICY "employee_compensation_director" ON public.employee_compensation FOR ALL
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');
CREATE POLICY "employee_compensation_branch" ON public.employee_compensation FOR ALL
  USING (get_my_internal_role() IN ('hr', 'manager')
         AND staff_id IN (SELECT id FROM public.internal_profiles WHERE branch_id = get_my_branch()))
  WITH CHECK (get_my_internal_role() IN ('hr', 'manager')
         AND staff_id IN (SELECT id FROM public.internal_profiles WHERE branch_id = get_my_branch()));
CREATE POLICY "employee_compensation_finance_read" ON public.employee_compensation FOR SELECT
  USING (get_my_internal_role() = 'finance'
         AND staff_id IN (SELECT id FROM public.internal_profiles WHERE branch_id = get_my_branch()));

-- Periods: director all; hr/manager full on own branch; finance read + mark paid.
CREATE POLICY "payroll_periods_director" ON public.payroll_periods FOR ALL
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');
CREATE POLICY "payroll_periods_branch" ON public.payroll_periods FOR ALL
  USING (get_my_internal_role() IN ('hr', 'manager') AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() IN ('hr', 'manager') AND branch_id = get_my_branch());
CREATE POLICY "payroll_periods_finance_read" ON public.payroll_periods FOR SELECT
  USING (get_my_internal_role() = 'finance' AND branch_id = get_my_branch());
CREATE POLICY "payroll_periods_finance_paid" ON public.payroll_periods FOR UPDATE
  USING (get_my_internal_role() = 'finance' AND branch_id = get_my_branch() AND status IN ('locked', 'paid'))
  WITH CHECK (get_my_internal_role() = 'finance' AND branch_id = get_my_branch());

-- Period children share one pattern.
CREATE POLICY "payroll_period_staff_director" ON public.payroll_period_staff FOR ALL
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');
CREATE POLICY "payroll_period_staff_branch" ON public.payroll_period_staff FOR ALL
  USING (get_my_internal_role() IN ('hr', 'manager') AND payroll_period_branch(period_id) = get_my_branch())
  WITH CHECK (get_my_internal_role() IN ('hr', 'manager') AND payroll_period_branch(period_id) = get_my_branch());
CREATE POLICY "payroll_period_staff_finance_read" ON public.payroll_period_staff FOR SELECT
  USING (get_my_internal_role() = 'finance' AND payroll_period_branch(period_id) = get_my_branch());

CREATE POLICY "payroll_activity_counts_director" ON public.payroll_activity_counts FOR ALL
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');
CREATE POLICY "payroll_activity_counts_branch" ON public.payroll_activity_counts FOR ALL
  USING (get_my_internal_role() IN ('hr', 'manager') AND payroll_period_branch(period_id) = get_my_branch())
  WITH CHECK (get_my_internal_role() IN ('hr', 'manager') AND payroll_period_branch(period_id) = get_my_branch());
CREATE POLICY "payroll_activity_counts_finance_read" ON public.payroll_activity_counts FOR SELECT
  USING (get_my_internal_role() = 'finance' AND payroll_period_branch(period_id) = get_my_branch());

CREATE POLICY "payroll_adjustments_director" ON public.payroll_adjustments FOR ALL
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');
CREATE POLICY "payroll_adjustments_branch" ON public.payroll_adjustments FOR ALL
  USING (get_my_internal_role() IN ('hr', 'manager') AND payroll_period_branch(period_id) = get_my_branch())
  WITH CHECK (get_my_internal_role() IN ('hr', 'manager') AND payroll_period_branch(period_id) = get_my_branch());
CREATE POLICY "payroll_adjustments_finance_read" ON public.payroll_adjustments FOR SELECT
  USING (get_my_internal_role() = 'finance' AND payroll_period_branch(period_id) = get_my_branch());

-- Slips: written by the approver at lock time; every employee reads their own.
CREATE POLICY "payroll_slips_director" ON public.payroll_slips FOR ALL
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');
CREATE POLICY "payroll_slips_manager" ON public.payroll_slips FOR ALL
  USING (get_my_internal_role() = 'manager' AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() = 'manager' AND branch_id = get_my_branch());
CREATE POLICY "payroll_slips_branch_read" ON public.payroll_slips FOR SELECT
  USING (get_my_internal_role() IN ('hr', 'finance') AND branch_id = get_my_branch());
CREATE POLICY "payroll_slips_self" ON public.payroll_slips FOR SELECT
  USING (staff_id = auth.uid());
