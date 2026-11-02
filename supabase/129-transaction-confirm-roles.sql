-- 129 — Who may confirm a pending payment
-- A pending payment (DP / CICILAN / PELUNASAN recorded at the front desk) is
-- confirmed once someone has checked the money actually arrived. Admins record
-- payments, so they must not also approve them (e.g. ROSLANMANALU, 2 Nov 2026:
-- a PELUNASAN entered by admin read "Lunas" before anyone checked the bank).
--
-- Only finance / manager / director may move a transaction to 'confirmed'.
-- Inserting an already-confirmed row (LUNAS / package payments, auto-confirmed
-- at entry) is unchanged — this only guards the pending → confirmed review.
-- Enforced here so the REST API can't skip the UI's role check.
--
-- Run this in your Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.transactions_confirm_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Service role / SQL editor (no auth.uid()) is unrestricted — DOKU settle etc.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed' THEN
    IF get_my_internal_role() NOT IN ('finance', 'manager', 'director') THEN
      RAISE EXCEPTION 'Hanya Finance, Manager atau Director yang dapat mengonfirmasi pembayaran.';
    END IF;
    NEW.confirmed_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_confirm_guard ON public.transactions;
CREATE TRIGGER transactions_confirm_guard
  BEFORE UPDATE OF status ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_confirm_guard();
