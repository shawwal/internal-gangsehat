-- Penggajian Griya Anak (/griya-anak/penggajian).
-- Same payroll tables and engine as /payroll; this adds the rules of the Griya
-- Anak sheet (reference/2603-10 Gaji Oktober Edit.xlsx) as configurable options:
--
--   1. ABS code T (Tugas — on duty outside the clinic) → attendance status 'duty'.
--      Counts as present for the operasional ratio.
--   2. Operasional rule 'threshold_full': r = (masuk + tugas) / hari kerja;
--      r ≥ threshold → full operasional, else r × operasional.
--      (The Pontianak 'prorata' rule pays 0 below the threshold instead.)
--   3. incentive_full_threshold: capaian ≥ this share of the target pays the
--      full insentif (Griya admin: 75%). 1 = the old min(1, qty / target).
--   4. Manual activity KPI_ADMIN — "Capaian Kinerja Admin (%)", target 100.
--   5. Griya Anak branches: Alfa = Rp50.000 / day (global rule is Rp100.000).

-- 1. Tugas
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'absent', 'late', 'leave', 'sick', 'izin', 'duty'));

-- 2. Operasional rule
ALTER TABLE public.employee_compensation DROP CONSTRAINT IF EXISTS employee_compensation_operasional_mode_check;
ALTER TABLE public.employee_compensation
  ADD CONSTRAINT employee_compensation_operasional_mode_check
  CHECK (operasional_mode IN ('prorata', 'daily_deduction', 'threshold_full', 'none'));

-- 3. Full-incentive threshold
ALTER TABLE public.employee_compensation
  ADD COLUMN IF NOT EXISTS incentive_full_threshold numeric NOT NULL DEFAULT 1;
ALTER TABLE public.employee_compensation DROP CONSTRAINT IF EXISTS employee_compensation_incentive_full_threshold_check;
ALTER TABLE public.employee_compensation
  ADD CONSTRAINT employee_compensation_incentive_full_threshold_check
  CHECK (incentive_full_threshold > 0 AND incentive_full_threshold <= 1);

-- 4. Capaian kinerja admin
INSERT INTO public.payroll_activity_types (code, label, group_label, count_mode, max_per_period, sort_order)
VALUES ('KPI_ADMIN', 'Capaian Kinerja Admin (%)', 'Lainnya', 'manual', 100, 52)
ON CONFLICT (code) DO NOTHING;

-- 5. Alfa rate for Griya Anak branches
INSERT INTO public.payroll_deduction_rules (branch_id, code, label, basis, calc_type, amount, sort_order)
SELECT g.branch_id, 'ALFA', 'Tidak absen', 'alfa_days', 'fixed', 50000, 2
FROM public.branch_griya_settings g
WHERE g.enabled
  AND NOT EXISTS (
    SELECT 1 FROM public.payroll_deduction_rules r WHERE r.branch_id = g.branch_id AND r.code = 'ALFA'
  );
