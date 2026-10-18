-- Migration: patient referral codes + reward points + reward catalog
--
-- Every logged-in patient (gangsehat.com/patient) gets a personal referral code
-- (patients.referral_code, "GS" + 6 chars). The code works on the same
-- gangsehat.com/daftar?ref=CODE field as affiliate codes; the registration then
-- carries referrer_patient_id instead of affiliate_id.
--
-- The referrer earns reward points once per referred customer, when that
-- patient's first income transaction is confirmed — same rule as affiliate
-- points (see 104-affiliate-points.sql), separate ledger.
--
-- Reward points are NOT session credits: patient_points (gangsehat repo, 025)
-- stays the session balance used by QR scans. Reward points are spent only on
-- reward_items, redeemed by staff on internal.gangsehat.com.
--
--   - reward_settings:    single row; points_per_referral (default 5) is the rate
--                         for NEW awards. Never hardcode the rate in app code.
--   - reward_points:      ledger. kind 'referral' (trigger), 'redemption'
--                         (redeem_reward, negative), 'adjustment' (director +/-).
--   - reward_items:       catalog managed by staff; stock NULL = unlimited.
--   - reward_redemptions: what was redeemed, with name/cost snapshots.
--
-- Reference copy: gangsehat repo supabase/migrations/049_patient_referral_rewards.sql

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS referral_code text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patients_referral_code_key') THEN
    ALTER TABLE public.patients ADD CONSTRAINT patients_referral_code_key UNIQUE (referral_code);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patients_referral_code_format') THEN
    ALTER TABLE public.patients ADD CONSTRAINT patients_referral_code_format
      CHECK (referral_code IS NULL OR referral_code ~ '^[A-Z0-9]{4,20}$');
  END IF;
END;
$$;

-- affiliate_code keeps storing the code as typed, for both kinds of code.
ALTER TABLE public.patient_registrations
  ADD COLUMN IF NOT EXISTS referrer_patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS patient_registrations_referrer_idx
  ON public.patient_registrations (referrer_patient_id) WHERE referrer_patient_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reward_settings (
  id                  boolean PRIMARY KEY DEFAULT true CHECK (id),
  points_per_referral integer NOT NULL DEFAULT 5 CHECK (points_per_referral >= 0),
  updated_by          uuid REFERENCES public.internal_profiles(id),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.reward_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.reward_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  name        text NOT NULL CHECK (length(trim(name)) > 0),
  description text,
  image_url   text,
  points_cost integer NOT NULL CHECK (points_cost > 0),
  stock       integer CHECK (stock IS NULL OR stock >= 0),
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES public.internal_profiles(id),
  updated_by  uuid REFERENCES public.internal_profiles(id)
);

CREATE INDEX IF NOT EXISTS reward_items_active_idx
  ON public.reward_items (is_active, sort_order, points_cost);

CREATE TABLE IF NOT EXISTS public.reward_redemptions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  patient_id     uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  reward_item_id uuid REFERENCES public.reward_items(id) ON DELETE SET NULL,
  item_name      text NOT NULL,
  points_cost    integer NOT NULL CHECK (points_cost > 0),
  quantity       integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total_points   integer NOT NULL CHECK (total_points > 0),
  status         text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
  branch_id      uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  note           text,
  redeemed_by    uuid REFERENCES public.internal_profiles(id),
  cancelled_by   uuid REFERENCES public.internal_profiles(id),
  cancelled_at   timestamptz
);

CREATE INDEX IF NOT EXISTS reward_redemptions_patient_idx
  ON public.reward_redemptions (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reward_redemptions_recent_idx
  ON public.reward_redemptions (created_at DESC);

CREATE TABLE IF NOT EXISTS public.reward_points (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  patient_id          uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  kind                text NOT NULL CHECK (kind IN ('referral', 'redemption', 'adjustment')),
  points              integer NOT NULL,
  referred_patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  registration_id     uuid REFERENCES public.patient_registrations(id) ON DELETE SET NULL,
  transaction_id      uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  redemption_id       uuid REFERENCES public.reward_redemptions(id) ON DELETE SET NULL,
  note                text,
  is_void             boolean NOT NULL DEFAULT false,
  created_by          uuid REFERENCES public.internal_profiles(id),
  CHECK (kind <> 'referral'   OR (points >= 0 AND referred_patient_id IS NOT NULL)),
  CHECK (kind <> 'redemption' OR (points < 0 AND redemption_id IS NOT NULL)),
  CHECK (kind <> 'adjustment' OR points <> 0)
);

-- One award per referred customer, ever (later payments don't add points).
CREATE UNIQUE INDEX IF NOT EXISTS reward_points_one_per_referred
  ON public.reward_points (referred_patient_id)
  WHERE kind = 'referral';

CREATE INDEX IF NOT EXISTS reward_points_patient_idx
  ON public.reward_points (patient_id, created_at DESC);

-- Balance per patient over non-void rows. security_invoker so RLS of the
-- caller applies (patients see only their own row).
CREATE OR REPLACE VIEW public.reward_point_balances
WITH (security_invoker = true) AS
SELECT
  patient_id,
  COALESCE(SUM(points) FILTER (WHERE points > 0), 0)::integer          AS earned,
  COALESCE(-SUM(points) FILTER (WHERE points < 0), 0)::integer         AS spent,
  COALESCE(SUM(points), 0)::integer                                    AS balance,
  COUNT(*) FILTER (WHERE kind = 'referral')::integer                   AS referral_count
FROM public.reward_points
WHERE NOT is_void
GROUP BY patient_id;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.reward_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_points      ENABLE ROW LEVEL SECURITY;

-- settings: everyone signed in may read the rate (shown on the patient card);
-- only director writes.
DROP POLICY IF EXISTS "reward_settings_select" ON public.reward_settings;
CREATE POLICY "reward_settings_select"
ON public.reward_settings FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "reward_settings_director_write" ON public.reward_settings;
CREATE POLICY "reward_settings_director_write"
ON public.reward_settings FOR ALL TO authenticated
USING (public.get_my_internal_role() = 'director')
WITH CHECK (public.get_my_internal_role() = 'director');

-- items: active items are public to signed-in users; staff manage everything.
DROP POLICY IF EXISTS "reward_items_select_active" ON public.reward_items;
CREATE POLICY "reward_items_select_active"
ON public.reward_items FOR SELECT TO authenticated
USING (is_active);

DROP POLICY IF EXISTS "reward_items_staff_all" ON public.reward_items;
CREATE POLICY "reward_items_staff_all"
ON public.reward_items FOR ALL TO authenticated
USING (public.get_my_internal_role() IN ('director', 'manager', 'admin', 'marketing'))
WITH CHECK (public.get_my_internal_role() IN ('director', 'manager', 'admin', 'marketing'));

-- redemptions + ledger: patients read their own; staff read all. Writes go
-- through redeem_reward / cancel_redemption / director adjustments.
DROP POLICY IF EXISTS "reward_redemptions_own_select" ON public.reward_redemptions;
CREATE POLICY "reward_redemptions_own_select"
ON public.reward_redemptions FOR SELECT TO authenticated
USING (patient_id IN (SELECT public.app_my_patient_ids()));

DROP POLICY IF EXISTS "reward_redemptions_staff_select" ON public.reward_redemptions;
CREATE POLICY "reward_redemptions_staff_select"
ON public.reward_redemptions FOR SELECT TO authenticated
USING (public.get_my_internal_role() IN ('director', 'manager', 'admin', 'marketing'));

DROP POLICY IF EXISTS "reward_points_own_select" ON public.reward_points;
CREATE POLICY "reward_points_own_select"
ON public.reward_points FOR SELECT TO authenticated
USING (patient_id IN (SELECT public.app_my_patient_ids()));

DROP POLICY IF EXISTS "reward_points_staff_select" ON public.reward_points;
CREATE POLICY "reward_points_staff_select"
ON public.reward_points FOR SELECT TO authenticated
USING (public.get_my_internal_role() IN ('director', 'manager', 'admin', 'marketing'));

DROP POLICY IF EXISTS "reward_points_director_all" ON public.reward_points;
CREATE POLICY "reward_points_director_all"
ON public.reward_points FOR ALL TO authenticated
USING (public.get_my_internal_role() = 'director')
WITH CHECK (public.get_my_internal_role() = 'director');

-- ---------------------------------------------------------------------------
-- Referral code (service role only; called by the gangsehat dashboard).
-- Unique across patients.referral_code AND affiliates.code, since both are
-- accepted by the same /daftar field.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_patient_referral_code(p_patient uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code     text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i          integer;
BEGIN
  SELECT referral_code INTO v_code FROM patients WHERE id = p_patient FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;

  FOR attempt IN 1..20 LOOP
    v_code := 'GS';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
    END LOOP;
    CONTINUE WHEN EXISTS (SELECT 1 FROM affiliates WHERE code = v_code)
               OR EXISTS (SELECT 1 FROM patients   WHERE referral_code = v_code);
    UPDATE patients SET referral_code = v_code WHERE id = p_patient;
    RETURN v_code;
  END LOOP;

  RAISE EXCEPTION 'Could not generate a unique referral code';
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_patient_referral_code(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Award (idempotent). Runs as owner so any role confirming a payment awards.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_patient_referral(p_patient uuid, p_tx uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg  record;
  v_rate integer;
BEGIN
  SELECT id, referrer_patient_id INTO v_reg
  FROM patient_registrations
  WHERE patient_id = p_patient AND referrer_patient_id IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  -- Self-referral never earns.
  IF v_reg.referrer_patient_id = p_patient THEN RETURN; END IF;

  SELECT points_per_referral INTO v_rate FROM reward_settings WHERE id;
  v_rate := COALESCE(v_rate, 5);
  IF v_rate = 0 THEN RETURN; END IF;

  INSERT INTO reward_points
    (patient_id, kind, points, referred_patient_id, registration_id, transaction_id)
  VALUES
    (v_reg.referrer_patient_id, 'referral', v_rate, p_patient, v_reg.id, p_tx)
  ON CONFLICT (referred_patient_id) WHERE kind = 'referral' DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.award_patient_referral(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Payment confirmed (insert as confirmed, or pending → confirmed).
CREATE OR REPLACE FUNCTION public.trg_transactions_referral_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM award_patient_referral(NEW.patient_id, NEW.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS transactions_referral_reward ON public.transactions;
CREATE TRIGGER transactions_referral_reward
AFTER INSERT OR UPDATE OF status, patient_id, type ON public.transactions
FOR EACH ROW
WHEN (NEW.type = 'income' AND NEW.status = 'confirmed' AND NEW.patient_id IS NOT NULL)
EXECUTE FUNCTION public.trg_transactions_referral_reward();

-- Registration linked to a patient that has already paid.
CREATE OR REPLACE FUNCTION public.trg_registrations_referral_reward()
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
    PERFORM award_patient_referral(NEW.patient_id, v_tx);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS patient_registrations_referral_reward ON public.patient_registrations;
CREATE TRIGGER patient_registrations_referral_reward
AFTER UPDATE OF patient_id, referrer_patient_id ON public.patient_registrations
FOR EACH ROW
WHEN (NEW.patient_id IS NOT NULL AND NEW.referrer_patient_id IS NOT NULL)
EXECUTE FUNCTION public.trg_registrations_referral_reward();

-- ---------------------------------------------------------------------------
-- Redeem / cancel. Called from internal.gangsehat.com with the user's session,
-- so get_my_internal_role() sees the staff member. Row locks on the patient
-- and item serialize concurrent redemptions (no double spend, no oversell).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_reward(
  p_patient  uuid,
  p_item     uuid,
  p_quantity integer DEFAULT 1,
  p_note     text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role    text := get_my_internal_role()::text;
  v_item    record;
  v_balance integer;
  v_total   integer;
  v_branch  uuid;
  v_id      uuid;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('director', 'manager', 'admin', 'marketing') THEN
    RAISE EXCEPTION 'Tidak memiliki akses.' USING ERRCODE = '42501';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Jumlah minimal 1.' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM patients WHERE id = p_patient FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pasien tidak ditemukan.' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_item FROM reward_items WHERE id = p_item FOR UPDATE;
  IF NOT FOUND OR NOT v_item.is_active THEN
    RAISE EXCEPTION 'Hadiah tidak tersedia.' USING ERRCODE = 'P0002';
  END IF;
  IF v_item.stock IS NOT NULL AND v_item.stock < p_quantity THEN
    RAISE EXCEPTION 'Stok hadiah tidak cukup (tersisa %).', v_item.stock USING ERRCODE = '22023';
  END IF;

  v_total := v_item.points_cost * p_quantity;
  SELECT COALESCE(SUM(points), 0) INTO v_balance
  FROM reward_points WHERE patient_id = p_patient AND NOT is_void;
  IF v_balance < v_total THEN
    RAISE EXCEPTION 'Poin tidak cukup (saldo %, dibutuhkan %).', v_balance, v_total USING ERRCODE = '22023';
  END IF;

  SELECT branch_id INTO v_branch FROM internal_profiles WHERE id = auth.uid();

  INSERT INTO reward_redemptions
    (patient_id, reward_item_id, item_name, points_cost, quantity, total_points, branch_id, note, redeemed_by)
  VALUES
    (p_patient, v_item.id, v_item.name, v_item.points_cost, p_quantity, v_total, v_branch,
     NULLIF(trim(p_note), ''), auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO reward_points (patient_id, kind, points, redemption_id, note, created_by)
  VALUES (p_patient, 'redemption', -v_total, v_id,
          v_item.name || CASE WHEN p_quantity > 1 THEN ' ×' || p_quantity ELSE '' END, auth.uid());

  IF v_item.stock IS NOT NULL THEN
    UPDATE reward_items SET stock = stock - p_quantity, updated_at = now() WHERE id = v_item.id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_reward(uuid, uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid, uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_redemption(p_redemption uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := get_my_internal_role()::text;
  v_red  record;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('director', 'manager', 'admin', 'marketing') THEN
    RAISE EXCEPTION 'Tidak memiliki akses.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_red FROM reward_redemptions WHERE id = p_redemption FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Penukaran tidak ditemukan.' USING ERRCODE = 'P0002'; END IF;
  IF v_red.status <> 'completed' THEN
    RAISE EXCEPTION 'Penukaran sudah dibatalkan.' USING ERRCODE = '22023';
  END IF;

  UPDATE reward_redemptions
  SET status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now()
  WHERE id = p_redemption;

  UPDATE reward_points SET is_void = true WHERE redemption_id = p_redemption;

  UPDATE reward_items
  SET stock = stock + v_red.quantity, updated_at = now()
  WHERE id = v_red.reward_item_id AND stock IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_redemption(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_redemption(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------
-- Codes for every patient that has a gangsehat.com account.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.patients WHERE profile_id IS NOT NULL AND referral_code IS NULL LOOP
    PERFORM public.ensure_patient_referral_code(r.id);
  END LOOP;
END;
$$;
