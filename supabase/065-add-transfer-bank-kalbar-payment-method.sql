-- Run this in the Supabase SQL editor.
--
-- Adds "TRANSFER BANK KALBAR" as a valid transactions.payment_method value,
-- alongside the existing TUNAI / TRANSFER BCA / EDC BCA.

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_payment_method_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_payment_method_check
  CHECK (payment_method = ANY (ARRAY['TUNAI'::text, 'TRANSFER BCA'::text, 'EDC BCA'::text, 'TRANSFER BANK KALBAR'::text]));
