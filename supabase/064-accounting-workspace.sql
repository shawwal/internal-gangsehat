-- Run this in the Supabase SQL editor.
--
-- Accountant Workspace: a new /finance/accounting page that replaces the
-- "AKUNTANSI GRIYA ANAK 2026" Excel file for daily bookkeeping. Most of the
-- data model already existed (transactions, internal_layanan) — this
-- migration adds only what was genuinely missing: an editable per-branch
-- expense category list (Excel's Pengaturan!F, currently hardcoded in the
-- app) and an editable cash opening balance per branch/year (Excel's Arus
-- Kas "Saldo Awal", currently nonexistent).

-- ── Expense categories (branch-scoped, editable) ───────────────────────────

CREATE TABLE IF NOT EXISTS public.internal_expense_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, name)
);

ALTER TABLE public.internal_expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_expense_categories: director all"
ON public.internal_expense_categories FOR ALL
USING (get_my_internal_role() = 'director')
WITH CHECK (get_my_internal_role() = 'director');

CREATE POLICY "internal_expense_categories: manager own branch"
ON public.internal_expense_categories FOR ALL
USING (get_my_internal_role() = 'manager' AND branch_id = get_my_branch())
WITH CHECK (get_my_internal_role() = 'manager' AND branch_id = get_my_branch());

CREATE POLICY "internal_expense_categories: finance own branch"
ON public.internal_expense_categories FOR ALL
USING (get_my_internal_role() = 'finance' AND branch_id = get_my_branch())
WITH CHECK (get_my_internal_role() = 'finance' AND branch_id = get_my_branch());

-- Any logged-in internal user can read (dropdowns elsewhere may want this).
CREATE POLICY "internal_expense_categories: staff read"
ON public.internal_expense_categories FOR SELECT
TO authenticated USING (get_my_internal_role() IS NOT NULL);

-- Seed every existing branch with today's hardcoded 7 categories so nothing
-- breaks; accountants can rename/add more (e.g. "Saving THR") afterward.
INSERT INTO public.internal_expense_categories (branch_id, name, sort_order)
SELECT b.id, cat.name, cat.sort_order
FROM public.branches b
CROSS JOIN (VALUES
  ('BEBAN PELAYANAN', 1),
  ('GAJI',            2),
  ('SEWA',            3),
  ('LISTRIK',         4),
  ('MARKETING',       5),
  ('TUKAR TUNAI',     6),
  ('LAINNYA',         7)
) AS cat(name, sort_order)
ON CONFLICT (branch_id, name) DO NOTHING;

-- ── Cash flow opening balance (branch + year) ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.internal_cash_opening_balance (
  branch_id   uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  year        int NOT NULL,
  amount      numeric NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES public.internal_profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (branch_id, year)
);

ALTER TABLE public.internal_cash_opening_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_cash_opening_balance: director all"
ON public.internal_cash_opening_balance FOR ALL
USING (get_my_internal_role() = 'director')
WITH CHECK (get_my_internal_role() = 'director');

CREATE POLICY "internal_cash_opening_balance: manager own branch"
ON public.internal_cash_opening_balance FOR ALL
USING (get_my_internal_role() = 'manager' AND branch_id = get_my_branch())
WITH CHECK (get_my_internal_role() = 'manager' AND branch_id = get_my_branch());

CREATE POLICY "internal_cash_opening_balance: finance own branch"
ON public.internal_cash_opening_balance FOR ALL
USING (get_my_internal_role() = 'finance' AND branch_id = get_my_branch())
WITH CHECK (get_my_internal_role() = 'finance' AND branch_id = get_my_branch());

-- ── internal_layanan: finance needs write access too ───────────────────────
-- Currently only director/manager can manage the price catalog (see
-- 055-sport-massage-branch-settings.sql). The accountant workspace's
-- Pengaturan tab lets finance manage their own branch's prices.

CREATE POLICY "internal_layanan: finance own branch"
ON public.internal_layanan FOR ALL
USING (get_my_internal_role() = 'finance' AND branch_id = get_my_branch())
WITH CHECK (get_my_internal_role() = 'finance' AND branch_id = get_my_branch());
