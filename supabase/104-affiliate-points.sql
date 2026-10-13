-- Migration: affiliate points
--
-- An affiliate earns points once per referred customer, when that patient's
-- first income transaction is confirmed. "Referred" = an approved
-- patient_registrations row (gangsehat.com/daftar?ref=CODE) carrying
-- affiliate_id, whose patient_id points at the patient (see 102-affiliates.sql).
--
--   - affiliate_settings: single row; points_per_customer (default 10) is the
--     rate for NEW awards. Never hardcode the rate in app code.
--   - affiliate_points: ledger. kind 'referral' (one per patient, written by the
--     trigger) or 'adjustment' (director +/-). Director may edit points / void
--     any row; default_points keeps the rate snapshot at award time.
--
-- Awarding happens in the DB because income rows are written from many paths
-- (finance, jadwal, packages, home visit, DOKU settle, ...). A confirmed
-- transaction that later becomes rejected does NOT revoke — director voids.

CREATE TABLE IF NOT EXISTS public.affiliate_settings (
  id                  boolean PRIMARY KEY DEFAULT true CHECK (id),
  points_per_customer integer NOT NULL DEFAULT 10 CHECK (points_per_customer >= 0),
  updated_by          uuid REFERENCES public.internal_profiles(id),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.affiliate_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.affiliate_points (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  affiliate_id    uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('referral', 'adjustment')),
  patient_id      uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  registration_id uuid REFERENCES public.patient_registrations(id) ON DELETE SET NULL,
  transaction_id  uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  points          integer NOT NULL,
  default_points  integer,
  note            text,
  is_void         boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES public.internal_profiles(id),
  edited_by       uuid REFERENCES public.internal_profiles(id),
  edited_at       timestamptz,
  CHECK (kind <> 'referral' OR patient_id IS NOT NULL OR registration_id IS NOT NULL)
);

-- One award per customer, ever (later payments don't add points).
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_points_one_per_patient
  ON public.affiliate_points (patient_id)
  WHERE kind = 'referral';

CREATE INDEX IF NOT EXISTS affiliate_points_affiliate_idx
  ON public.affiliate_points (affiliate_id, created_at DESC);

ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_points   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "affiliate_settings_director_all" ON public.affiliate_settings;
CREATE POLICY "affiliate_settings_director_all"
ON public.affiliate_settings FOR ALL TO authenticated
USING (public.get_my_internal_role() = 'director')
WITH CHECK (public.get_my_internal_role() = 'director');

DROP POLICY IF EXISTS "affiliate_settings_staff_select" ON public.affiliate_settings;
CREATE POLICY "affiliate_settings_staff_select"
ON public.affiliate_settings FOR SELECT TO authenticated
USING (public.get_my_internal_role() IN ('manager', 'admin'));

DROP POLICY IF EXISTS "affiliate_points_director_all" ON public.affiliate_points;
CREATE POLICY "affiliate_points_director_all"
ON public.affiliate_points FOR ALL TO authenticated
USING (public.get_my_internal_role() = 'director')
WITH CHECK (public.get_my_internal_role() = 'director');

DROP POLICY IF EXISTS "affiliate_points_staff_select" ON public.affiliate_points;
CREATE POLICY "affiliate_points_staff_select"
ON public.affiliate_points FOR SELECT TO authenticated
USING (public.get_my_internal_role() IN ('manager', 'admin'));

-- ---------------------------------------------------------------------------
-- Award (idempotent). Runs as owner so any role confirming a payment awards.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_affiliate_referral(p_patient uuid, p_tx uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg  record;
  v_rate integer;
BEGIN
  SELECT id, affiliate_id INTO v_reg
  FROM patient_registrations
  WHERE patient_id = p_patient AND affiliate_id IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT points_per_customer INTO v_rate FROM affiliate_settings WHERE id;

  INSERT INTO affiliate_points
    (affiliate_id, kind, patient_id, registration_id, transaction_id, points, default_points)
  VALUES
    (v_reg.affiliate_id, 'referral', p_patient, v_reg.id, p_tx, COALESCE(v_rate, 10), COALESCE(v_rate, 10))
  ON CONFLICT (patient_id) WHERE kind = 'referral' DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.award_affiliate_referral(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Payment confirmed (insert as confirmed, or pending → confirmed).
CREATE OR REPLACE FUNCTION public.trg_transactions_affiliate_award()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM award_affiliate_referral(NEW.patient_id, NEW.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS transactions_affiliate_award ON public.transactions;
CREATE TRIGGER transactions_affiliate_award
AFTER INSERT OR UPDATE OF status, patient_id, type ON public.transactions
FOR EACH ROW
WHEN (NEW.type = 'income' AND NEW.status = 'confirmed' AND NEW.patient_id IS NOT NULL)
EXECUTE FUNCTION public.trg_transactions_affiliate_award();

-- Registration linked to a patient that has already paid.
CREATE OR REPLACE FUNCTION public.trg_registrations_affiliate_award()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx uuid;
BEGIN
  SELECT id INTO v_tx
  FROM transactions
  WHERE patient_id = NEW.patient_id AND type = 'income' AND status = 'confirmed'
  ORDER BY transaction_date, created_at
  LIMIT 1;
  IF v_tx IS NOT NULL THEN
    PERFORM award_affiliate_referral(NEW.patient_id, v_tx);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS patient_registrations_affiliate_award ON public.patient_registrations;
CREATE TRIGGER patient_registrations_affiliate_award
AFTER UPDATE OF patient_id, affiliate_id ON public.patient_registrations
FOR EACH ROW
WHEN (NEW.patient_id IS NOT NULL AND NEW.affiliate_id IS NOT NULL)
EXECUTE FUNCTION public.trg_registrations_affiliate_award();

-- ---------------------------------------------------------------------------
-- Backfill: referred patients that already have a confirmed payment.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (t.patient_id) t.patient_id, t.id
    FROM transactions t
    JOIN patient_registrations pr ON pr.patient_id = t.patient_id AND pr.affiliate_id IS NOT NULL
    WHERE t.type = 'income' AND t.status = 'confirmed'
    ORDER BY t.patient_id, t.transaction_date, t.created_at
  LOOP
    PERFORM public.award_affiliate_referral(r.patient_id, r.id);
  END LOOP;
END;
$$;
