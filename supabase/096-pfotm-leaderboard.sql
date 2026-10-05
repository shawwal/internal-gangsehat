-- Migration 096: PFOTM (Powerful Fisioterapis of the Month) ranking system.
--
-- Mirrors the legacy leaderboard workbook (reference/2.2 …xlsx):
--   Kunjungan / Keuangan / Rujukan SM → auto metrics (patient_visits, patient_packages,
--                                       patients.referred_by_staff_id), HR may override
--   Data         → pfotm_point_rules (weights, never hardcoded) × metrics
--   Rank         → computed live for open periods (lib/pfotm/engine.ts)
--   Rekap Data / Rekap Poin → pfotm_entries frozen at "Lock Period"
--   Daftar Pemenang         → derived from rank = 1 of locked periods
--
-- Run this in the Supabase SQL editor.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Rujukan SM: which physiotherapist referred this patient
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS referred_by_staff_id uuid
  REFERENCES public.internal_profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_patients_referred_by
  ON public.patients (referred_by_staff_id) WHERE referred_by_staff_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Point rules (Point_Rules table from the spec)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pfotm_point_rules (
  metric_key    text PRIMARY KEY,
  metric_label  text NOT NULL,
  weight        numeric(6,2) NOT NULL,
  is_penalty    bool NOT NULL DEFAULT false,
  source        text NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'manual')),
  description   text,
  sort_order    int  NOT NULL DEFAULT 0,
  is_active     bool NOT NULL DEFAULT true,
  updated_by    uuid REFERENCES public.internal_profiles(id),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Defaults from the "Data" sheet. Alfa is −2 (the sheet's +2 rewarded absence;
-- imported history keeps +2 through its frozen rules_snapshot).
INSERT INTO public.pfotm_point_rules (metric_key, metric_label, weight, is_penalty, source, description, sort_order) VALUES
  ('hadir',             'Hadir',             1,   false, 'auto',   'Hari hadir (termasuk hari terlambat)',                 1),
  ('terlambat',         'Terlambat',        -1,   true,  'auto',   'Jumlah hari terlambat',                                2),
  ('alfa',              'Alfa',             -2,   true,  'auto',   'Tidak hadir tanpa keterangan',                         3),
  ('kunjungan',         'Jumlah Kunjungan',  1,   false, 'auto',   'Sesi klinik yang dihadiri (TA, sesi, paket)',          4),
  ('paket_1',           'Paket 1',           3,   false, 'auto',   'Penjualan paket klinik P1 (5 sesi)',                   5),
  ('paket_2',           'Paket 2',           6,   false, 'auto',   'Penjualan paket klinik P2 (10 sesi)',                  6),
  ('paket_3',           'Paket 3',          12,   false, 'manual', 'Penjualan paket klinik P3',                            7),
  ('ta_sesi_visit',     'TA/Sesi Visit',     2,   false, 'auto',   'TA Visit + Sesi Visit yang dihadiri',                  8),
  ('paket_visit',       'Paket Visit',      10,   false, 'auto',   'Penjualan paket home visit',                           9),
  ('rujukan_sm',        'Rujukan SM',        2,   false, 'auto',   'Pasien baru yang dirujuk oleh fisioterapis',          10),
  ('kegiatan_external', 'Kegiatan External', 2,   false, 'manual', 'Kegiatan eksternal (event, seminar, dll.)',           11)
ON CONFLICT (metric_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Evaluation periods and entries
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pfotm_periods (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id              uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  period_year            int  NOT NULL,
  period_month           int  NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  start_date             date NOT NULL,
  end_date               date NOT NULL,
  working_days           int  NOT NULL DEFAULT 0 CHECK (working_days >= 0),
  working_days_override  bool NOT NULL DEFAULT false,
  is_locked              bool NOT NULL DEFAULT false,
  locked_by              uuid REFERENCES public.internal_profiles(id),
  locked_at              timestamptz,
  rules_snapshot         jsonb,      -- [{ metric_key, metric_label, weight, is_penalty }] frozen at lock
  created_by             uuid REFERENCES public.internal_profiles(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, period_year, period_month),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.pfotm_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id         uuid NOT NULL REFERENCES public.pfotm_periods(id) ON DELETE CASCADE,
  staff_id          uuid REFERENCES public.internal_profiles(id) ON DELETE SET NULL,
  display_name      text NOT NULL,                       -- kept so imported/departed staff still show
  auto_metrics      jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { "hadir": 23, "kunjungan": 91, … }
  override_metrics  jsonb NOT NULL DEFAULT '{}'::jsonb,  -- HR corrections; win over auto
  excluded          bool NOT NULL DEFAULT false,
  -- frozen at lock
  metrics           jsonb,
  points_breakdown  jsonb,
  total_points      numeric,
  rank              int,
  kpis              jsonb,                               -- { kehadiran, disiplin, kunjungan_per_hadir, paket_per_hadir, jumlah_paket }
  updated_by        uuid REFERENCES public.internal_profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, staff_id)
);
CREATE INDEX IF NOT EXISTS idx_pfotm_entries_period ON public.pfotm_entries (period_id);

DROP TRIGGER IF EXISTS pfotm_point_rules_updated_at ON public.pfotm_point_rules;
CREATE TRIGGER pfotm_point_rules_updated_at BEFORE UPDATE ON public.pfotm_point_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS pfotm_periods_updated_at ON public.pfotm_periods;
CREATE TRIGGER pfotm_periods_updated_at BEFORE UPDATE ON public.pfotm_periods
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS pfotm_entries_updated_at ON public.pfotm_entries;
CREATE TRIGGER pfotm_entries_updated_at BEFORE UPDATE ON public.pfotm_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Lock guards — only the director (super-admin) may touch a locked period.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pfotm_period_branch(p_period_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.pfotm_periods WHERE id = p_period_id;
$$;

CREATE OR REPLACE FUNCTION public.pfotm_guard_entries()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_period uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN v_period := OLD.period_id; ELSE v_period := NEW.period_id; END IF;
  IF COALESCE((SELECT is_locked FROM public.pfotm_periods WHERE id = v_period), false)
     AND public.get_my_internal_role() IS DISTINCT FROM 'director'
     AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Periode PFOTM sudah dikunci — perubahan memerlukan override direktur.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pfotm_entries_guard ON public.pfotm_entries;
CREATE TRIGGER pfotm_entries_guard BEFORE INSERT OR UPDATE OR DELETE ON public.pfotm_entries
  FOR EACH ROW EXECUTE FUNCTION public.pfotm_guard_entries();

CREATE OR REPLACE FUNCTION public.pfotm_guard_period()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- auth.uid() IS NULL = service-role scripts (history import)
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF OLD.is_locked AND NOT NEW.is_locked AND public.get_my_internal_role() <> 'director' THEN
    RAISE EXCEPTION 'Hanya direktur yang dapat membuka kunci periode PFOTM.';
  END IF;
  IF OLD.is_locked AND NEW.is_locked
     AND (NEW.working_days IS DISTINCT FROM OLD.working_days OR NEW.rules_snapshot IS DISTINCT FROM OLD.rules_snapshot)
     AND public.get_my_internal_role() <> 'director' THEN
    RAISE EXCEPTION 'Periode PFOTM sudah dikunci.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pfotm_periods_guard ON public.pfotm_periods;
CREATE TRIGGER pfotm_periods_guard BEFORE UPDATE ON public.pfotm_periods
  FOR EACH ROW EXECUTE FUNCTION public.pfotm_guard_period();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS — the board is visible to every active staff member of the branch
--    (gamification); HR/manager/admin enter data; director sees all.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.pfotm_point_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfotm_periods     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pfotm_entries     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pfotm_point_rules_read" ON public.pfotm_point_rules FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "pfotm_point_rules_write" ON public.pfotm_point_rules FOR ALL
  USING (get_my_internal_role() IN ('director', 'manager', 'hr'))
  WITH CHECK (get_my_internal_role() IN ('director', 'manager', 'hr'));

CREATE POLICY "pfotm_periods_director" ON public.pfotm_periods FOR ALL
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');
CREATE POLICY "pfotm_periods_branch_write" ON public.pfotm_periods FOR ALL
  USING (get_my_internal_role() IN ('hr', 'manager', 'admin') AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() IN ('hr', 'manager', 'admin') AND branch_id = get_my_branch());
CREATE POLICY "pfotm_periods_branch_read" ON public.pfotm_periods FOR SELECT
  USING (branch_id = get_my_branch());

CREATE POLICY "pfotm_entries_director" ON public.pfotm_entries FOR ALL
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');
CREATE POLICY "pfotm_entries_branch_write" ON public.pfotm_entries FOR ALL
  USING (get_my_internal_role() IN ('hr', 'manager', 'admin') AND pfotm_period_branch(period_id) = get_my_branch())
  WITH CHECK (get_my_internal_role() IN ('hr', 'manager', 'admin') AND pfotm_period_branch(period_id) = get_my_branch());
CREATE POLICY "pfotm_entries_branch_read" ON public.pfotm_entries FOR SELECT
  USING (pfotm_period_branch(period_id) = get_my_branch());
