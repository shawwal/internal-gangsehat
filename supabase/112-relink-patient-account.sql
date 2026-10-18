-- Migration: move a clinic patient record to another gangsehat.com account
--
-- One clinic record belongs to one account. When the same person signs up
-- twice (e.g. two emails), staff can move the record to the requesting
-- account from /patient-registrations/accounts. The previous account is
-- detached and gets a fresh, empty signup row (not linked), so it keeps
-- working but no longer sees the clinic record. Then link_patient_account
-- (110) attaches the requesting account as usual.
--
-- Raises: web_not_found | target_not_found (from link_patient_account)
--
-- Reference copy: gangsehat repo supabase/migrations/053_relink_patient_account.sql

CREATE OR REPLACE FUNCTION public.relink_patient_account(p_web uuid, p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_web    record;
  v_target record;
BEGIN
  SELECT id, profile_id INTO v_web FROM patients WHERE id = p_web FOR UPDATE;
  IF NOT FOUND OR v_web.profile_id IS NULL THEN RAISE EXCEPTION 'web_not_found'; END IF;
  SELECT id, profile_id, encrypted_name INTO v_target FROM patients WHERE id = p_target FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'target_not_found'; END IF;

  IF v_target.profile_id IS NOT NULL AND v_target.profile_id <> v_web.profile_id THEN
    -- Detach the previous account: it gets an empty signup row of its own.
    INSERT INTO patients (profile_id, encrypted_name, encrypted_phone, member_type_id, is_active)
    VALUES (v_target.profile_id, v_target.encrypted_name, '', 1, true);

    UPDATE patients
    SET profile_id = NULL, account_linked_at = NULL, updated_at = now()
    WHERE id = p_target;
  END IF;

  PERFORM link_patient_account(p_web, p_target);

  -- Online bookings follow the record; status lookups are by account.
  UPDATE online_bookings SET profile_id = v_web.profile_id WHERE patient_id = p_target;
END;
$$;

REVOKE ALL ON FUNCTION public.relink_patient_account(uuid, uuid) FROM PUBLIC, anon, authenticated;
