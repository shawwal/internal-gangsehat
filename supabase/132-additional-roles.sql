-- 132: one account, several work roles (e.g. Terapis + Terapis Sport Massage).
--
-- `role` stays the PRIMARY role: it alone drives RLS (get_my_internal_role()),
-- the home redirect and the access level. `additional_roles` only lists extra
-- *work* functions so the person also shows up where that work happens
-- (Jadwal Harian / Jadwal Sport Massage columns, therapist pickers, Sport
-- Massage payroll roster) and can open those pages. Privileged roles can never
-- be added here, so this can't escalate access.

ALTER TABLE internal_profiles
  ADD COLUMN IF NOT EXISTS additional_roles internal_user_role[] NOT NULL DEFAULT '{}';

ALTER TABLE internal_profiles DROP CONSTRAINT IF EXISTS internal_profiles_additional_roles_check;
ALTER TABLE internal_profiles ADD CONSTRAINT internal_profiles_additional_roles_check
  CHECK (additional_roles <@ ARRAY['therapist', 'sport_massage_therapist', 'staff']::internal_user_role[]);

-- Only director / HR / manager may change someone's additional roles
-- (service-role / SQL editor calls have no auth.uid() and pass through).
CREATE OR REPLACE FUNCTION internal_profiles_additional_roles_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.additional_roles IS DISTINCT FROM OLD.additional_roles
     AND auth.uid() IS NOT NULL
     AND COALESCE(get_my_internal_role(), '') NOT IN ('director', 'hr', 'manager') THEN
    RAISE EXCEPTION 'Tidak berhak mengubah peran tambahan';
  END IF;
  -- The primary role never needs repeating in the extra list.
  NEW.additional_roles := ARRAY(
    SELECT DISTINCT r FROM unnest(NEW.additional_roles) r WHERE r <> NEW.role
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS internal_profiles_additional_roles_guard ON internal_profiles;
CREATE TRIGGER internal_profiles_additional_roles_guard
  BEFORE UPDATE ON internal_profiles
  FOR EACH ROW EXECUTE FUNCTION internal_profiles_additional_roles_guard();

CREATE INDEX IF NOT EXISTS internal_profiles_additional_roles_idx
  ON internal_profiles USING gin (additional_roles);

-- For any future policy that must be role-gated for a work role.
CREATE OR REPLACE FUNCTION has_internal_role(r text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM internal_profiles
    WHERE id = auth.uid() AND (role::text = r OR r = ANY(additional_roles::text[]))
  )
$$;
