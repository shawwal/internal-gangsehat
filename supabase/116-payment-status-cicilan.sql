-- Status Bayar gains CICILAN: a later installment of a purchase.
-- Run this in the Supabase SQL editor.
--
--   DP → CICILAN → … → PELUNASAN   (or a single LUNAS)
--
-- Only the first payment (LUNAS / DP) is a sale for KPIs (lib/metrics/achievement
-- countedSaleIds); CICILAN never counts. New installments from the settle dialog
-- and DOKU are written as CICILAN, the one that pays the order off as PELUNASAN.
-- Existing DP installments are converted separately by
-- data_migrations/dp-installments-to-cicilan.ts (dry run by default).

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%payment_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.transactions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.transactions ADD CONSTRAINT transactions_payment_status_check
  CHECK (payment_status IS NULL OR payment_status IN ('LUNAS', 'DP', 'CICILAN', 'PELUNASAN'));
