-- Migration: patients choose / regenerate their own referral code
--
-- Requires 108-patient-referral-rewards.sql. Patients edit their code on
-- gangsehat.com/patient; the server action calls set_patient_referral_code()
-- with the service role after resolving the signed-in patient.
--
--   p_code NULL  → new random "GS" + 6 code
--   p_code text  → custom code, normalized to upper case
--
-- Rules (enforced here so no client can bypass them):
--   - 4–20 chars, A–Z / 0–9 (same as the /daftar field and patients CHECK)
--   - unique across patients.referral_code AND affiliates.code
--   - not a reserved word (brand / official-looking codes)
--
-- Earned points are unaffected by a change: registrations reference the
-- referrer by patient id (referrer_patient_id), not by code. Links already
-- shared with the old code stop working.
--
-- Errors are raised with a stable message key the app maps to UI text:
--   invalid_format | reserved | taken | patient_not_found
--
-- Reference copy: gangsehat repo supabase/migrations/050_patient_referral_code_custom.sql

CREATE OR REPLACE FUNCTION public.set_patient_referral_code(p_patient uuid, p_code text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code     text := upper(trim(coalesce(p_code, '')));
  v_current  text;
  v_reserved constant text[] := ARRAY[
    'GANGSEHAT', 'GANG', 'SEHAT', 'GRIYA', 'GRIYAANAK', 'FISIO', 'FISIOTERAPI',
    'ADMIN', 'ADMINISTRATOR', 'DIREKTUR', 'DIRECTOR', 'MANAGER', 'STAFF', 'OFFICIAL', 'RESMI',
    'PROMO', 'DISKON', 'DISCOUNT', 'GRATIS', 'FREE', 'VOUCHER', 'HADIAH', 'REWARD',
    'TEST', 'TESTING', 'NULL', 'UNDEFINED'
  ];
BEGIN
  SELECT referral_code INTO v_current FROM patients WHERE id = p_patient FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'patient_not_found'; END IF;

  -- Random: clear and let the generator pick a fresh unique code.
  IF v_code = '' THEN
    UPDATE patients SET referral_code = NULL WHERE id = p_patient;
    RETURN ensure_patient_referral_code(p_patient);
  END IF;

  IF v_code !~ '^[A-Z0-9]{4,20}$' THEN RAISE EXCEPTION 'invalid_format'; END IF;
  IF v_code = v_current THEN RETURN v_code; END IF;
  IF v_code = ANY (v_reserved) THEN RAISE EXCEPTION 'reserved'; END IF;
  IF EXISTS (SELECT 1 FROM affiliates WHERE code = v_code)
     OR EXISTS (SELECT 1 FROM patients WHERE referral_code = v_code AND id <> p_patient) THEN
    RAISE EXCEPTION 'taken';
  END IF;

  BEGIN
    UPDATE patients SET referral_code = v_code WHERE id = p_patient;
  EXCEPTION WHEN unique_violation THEN
    -- Someone claimed it between the check and the update.
    RAISE EXCEPTION 'taken';
  END;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.set_patient_referral_code(uuid, text) FROM PUBLIC, anon, authenticated;
