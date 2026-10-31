-- Arus Kas: Saldo Awal per semester. Semester 1's row is the yearly opening
-- balance (also used by "Tahun penuh"); Semester 2 gets its own figure (cash on
-- hand on 1 July) instead of carrying Jan–Jun over. Existing rows become semester 1.

ALTER TABLE public.internal_cash_opening_balance
  ADD COLUMN IF NOT EXISTS semester smallint NOT NULL DEFAULT 1 CHECK (semester IN (1, 2));

ALTER TABLE public.internal_cash_opening_balance
  DROP CONSTRAINT IF EXISTS internal_cash_opening_balance_pkey;
ALTER TABLE public.internal_cash_opening_balance
  ADD PRIMARY KEY (branch_id, year, semester);
