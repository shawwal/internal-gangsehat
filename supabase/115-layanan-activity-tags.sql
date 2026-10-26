-- Payroll + PFOTM counting from payments, keyed by Layanan (Tarif Layanan rows).
-- Run this in the Supabase SQL editor.
--
-- Layanan names differ per branch, so the rule lives on the branch's own price
-- list rows (by id — renaming a Layanan never breaks the count). A branch whose
-- Layanan carry no tags keeps the old visit/category counting.
--
--   payroll_units — activity code → units, e.g. {"VISIT_TA":1,"VISIT_JARAK":1}.
--                   Every code that appears on a branch's Layanan is counted from
--                   that branch's income payments (LUNAS / PELUNASAN, credited
--                   to the payment's Fisio) instead of Jadwal Harian visits.
--   pfotm_metric  — PFOTM sales column this Layanan counts toward. When any
--                   Layanan of a branch has one, PFOTM sales there are mapped
--                   by Layanan instead of transaction category.
--
-- employee_payroll_profiles.branch_total_codes — activity codes whose auto
-- count for this employee is the whole branch's total (Target Progress rule),
-- not their own patients. Supported codes: lib/payroll/paymentActivity.ts.

ALTER TABLE public.internal_layanan
  ADD COLUMN IF NOT EXISTS payroll_units jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pfotm_metric text;

ALTER TABLE public.internal_layanan DROP CONSTRAINT IF EXISTS internal_layanan_pfotm_metric_check;
ALTER TABLE public.internal_layanan ADD CONSTRAINT internal_layanan_pfotm_metric_check
  CHECK (pfotm_metric IS NULL OR pfotm_metric IN ('paket_1', 'paket_2', 'paket_3', 'ta_sesi_visit', 'paket_visit'));

ALTER TABLE public.employee_payroll_profiles
  ADD COLUMN IF NOT EXISTS branch_total_codes text[] NOT NULL DEFAULT '{}';

-- ── Fisioterapi Gang Sehat Pontianak ────────────────────────────────────────
-- Paket 1/2/3 by session count: 5 (Paket 1 / Silver), 10 (Paket 2 / Gold),
-- 20 (Platinum). Jarak: TA/Sesi + Jarak = 1, Paket + Jarak = 10 (10 sessions).

WITH l AS (
  SELECT id, regexp_replace(trim(nama), '\s+', ' ', 'g') AS n
  FROM public.internal_layanan
  WHERE branch_id = 'cfe27e13-ba0b-440d-99f3-03e059efb877'
)
UPDATE public.internal_layanan il
SET payroll_units = v.units::jsonb, pfotm_metric = v.metric
FROM l
JOIN (VALUES
  ('Terapi Awal Home Visit Fisioterapi',          '{"VISIT_TA":1}',                  'ta_sesi_visit'),
  ('Terapi Awal Home Visit Fisioterapi + Jarak',  '{"VISIT_TA":1,"VISIT_JARAK":1}',  'ta_sesi_visit'),
  ('Sesi Terapi Home Visit Fisioterapi',          '{"VISIT_ST":1}',                  'ta_sesi_visit'),
  ('Sesi Terapi Home Visit Fisioterapi + Jarak',  '{"VISIT_ST":1,"VISIT_JARAK":1}',  'ta_sesi_visit'),
  ('Paket Home Visit Fisioterapi',                '{"VISIT_PT":1}',                  'paket_visit'),
  ('Paket Home Visit Fisioterapi + Jarak',        '{"VISIT_PT":1,"VISIT_JARAK":10}', 'paket_visit'),
  ('Paket 1 Fisioterapi',                         '{}',                              'paket_1'),
  ('Paket Silver Fisioterapi',                    '{}',                              'paket_1'),
  ('Paket 2 Fisioterapi',                         '{}',                              'paket_2'),
  ('Paket Gold Fisioterapi',                      '{}',                              'paket_2'),
  ('Paket Platinum Fisioterapi',                  '{}',                              'paket_3')
) AS v(n, units, metric) ON v.n = l.n
WHERE il.id = l.id;

-- Dhea Nanda K (admin): TA KLINIK = branch TA total.
INSERT INTO public.employee_payroll_profiles (staff_id, branch_total_codes)
VALUES ('ff4e54df-5cd1-48ad-bba9-a5eee53422e1', ARRAY['KLINIK_TA'])
ON CONFLICT (staff_id) DO UPDATE SET branch_total_codes = EXCLUDED.branch_total_codes;

-- ── Tarif Layanan: only director / manager edit ─────────────────────────────
-- The counting above depends on the price list, so finance loses write access
-- (reads via "internal_layanan: staff read"). Admin keeps it only on Griya Anak
-- branches, for /griya-anak/pengaturan.

DROP POLICY IF EXISTS "internal_layanan: finance own branch" ON public.internal_layanan;

DROP POLICY IF EXISTS "internal_layanan: admin own branch" ON public.internal_layanan;
CREATE POLICY "internal_layanan: admin own branch"
ON public.internal_layanan FOR ALL
USING (
  get_my_internal_role() = 'admin' AND branch_id = get_my_branch()
  AND EXISTS (SELECT 1 FROM public.branch_griya_settings g WHERE g.branch_id = internal_layanan.branch_id AND g.enabled)
)
WITH CHECK (
  get_my_internal_role() = 'admin' AND branch_id = get_my_branch()
  AND EXISTS (SELECT 1 FROM public.branch_griya_settings g WHERE g.branch_id = internal_layanan.branch_id AND g.enabled)
);
