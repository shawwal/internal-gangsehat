-- Migration: Griya Anak accountant workspace (Milestone 4)
-- Run this in the Supabase SQL editor, after 064 + 067.
--
-- /griya-anak/akuntansi reuses the existing accountant components
-- (components/finance/accounting/*) scoped to the Griya Anak branch, for
-- roles director / manager / admin. The accountant workspace was already
-- built (064) for finance/manager/director — this migration only:
--   1. gives the `admin` role write access to the two editable config tables
--      the Pengaturan tab manages (expense categories + cash opening balance);
--      internal_layanan admin access was already granted in 067.
--   2. seeds Griya Anak's expense-category list from the workbook's
--      "⚙️Pengaturan" sheet (Jenis Pengeluaran column).

-- ── 1. admin can manage its branch's accounting config ───────────────────

CREATE POLICY "internal_expense_categories: admin own branch"
ON public.internal_expense_categories FOR ALL
USING (get_my_internal_role() = 'admin' AND branch_id = get_my_branch())
WITH CHECK (get_my_internal_role() = 'admin' AND branch_id = get_my_branch());

CREATE POLICY "internal_cash_opening_balance: admin own branch"
ON public.internal_cash_opening_balance FOR ALL
USING (get_my_internal_role() = 'admin' AND branch_id = get_my_branch())
WITH CHECK (get_my_internal_role() = 'admin' AND branch_id = get_my_branch());

-- ── 2. seed Griya Anak expense categories ────────────────────────────────

INSERT INTO public.internal_expense_categories (branch_id, name, sort_order)
SELECT b.id, c.name, c.ord
FROM public.branches b
CROSS JOIN (VALUES
  ('BEBAN OPERASIONAL', 1),
  ('BEBAN ADM, UMUM & PERLENGKAPAN KANTOR', 2),
  ('BEBAN PELAYANAN', 3),
  ('BEBAN KONSUMSI', 4),
  ('BEBAN ACARA / PERTEMUAN', 5),
  ('BEBAN RAPAT', 6),
  ('BEBAN GAJI', 7),
  ('BEBAN JASA', 8),
  ('BEBAN PROMOSI', 9),
  ('BEBAN LAINNYA', 10),
  ('BEBAN TAK TERDUGA', 11),
  ('BEBAN BANK', 12),
  ('BPJS KETENAGAKERJAAN', 13),
  ('SAVING', 20),
  ('SAVING EDUKASI / LIBURAN', 21),
  ('SAVING BONUS', 22),
  ('SAVING THR', 23),
  ('SAVING CSR', 24),
  ('SAVING REWARDS', 25),
  ('SAVING KANTOR', 26),
  ('SAVING PERAWATAN & PEMELIHARAAN', 27),
  ('SAVING OPERASIONAL', 28),
  ('SAVING PROMOSI', 29)
) AS c(name, ord)
WHERE b.name ILIKE '%Griya Anak%'
ON CONFLICT (branch_id, name) DO NOTHING;
