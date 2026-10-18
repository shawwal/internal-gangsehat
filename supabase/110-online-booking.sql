-- Migration: online clinic booking from gangsehat.com + account linking
--
-- Patients signed in on gangsehat.com book a real clinic slot that lands in
-- Jadwal Harian (patient_visits). A slot is secured either by a remaining
-- package session (visit created immediately) or by a DOKU payment (slot held
-- in online_bookings until the payment link settles; settle.ts then creates the
-- visit and the income transaction with visit_id).
--
-- gangsehat.com never talks to DOKU or writes patient_visits itself: it calls
-- internal's signed /api/public/booking/* endpoints (lib/onlineBooking/*).
--
-- Account linking: a gangsehat.com signup creates its own patients row
-- (profile_id set, account_linked_at NULL). Linking moves the account onto the
-- clinic's patient record (link_patient_account) — automatically when phone +
-- birth date match, otherwise via patient_link_requests reviewed by staff.
--
-- Reference copy: gangsehat repo supabase/migrations/051_online_booking.sql

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
-- Set once a gangsehat.com account is attached to this clinic record.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS account_linked_at timestamptz;

-- NULL = not bookable online. Otherwise the patient_visits.service_type the
-- online visit gets (director sets it per service in /director/layanan).
ALTER TABLE public.internal_layanan
  ADD COLUMN IF NOT EXISTS online_service_type text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'internal_layanan_online_service_type_check') THEN
    ALTER TABLE public.internal_layanan ADD CONSTRAINT internal_layanan_online_service_type_check
      CHECK (online_service_type IS NULL OR online_service_type IN ('TERAPI AWAL', 'SESI TERAPI'));
  END IF;
END;
$$;

-- 'online' = booked by the patient on gangsehat.com (badge in Jadwal Harian).
ALTER TABLE public.patient_visits
  ADD COLUMN IF NOT EXISTS booking_source text;

-- ---------------------------------------------------------------------------
-- online_bookings: one row per online booking attempt (slot hold).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.online_bookings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  patient_id      uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL,
  branch_id       uuid NOT NULL REFERENCES public.branches(id),
  staff_id        uuid NOT NULL REFERENCES public.internal_profiles(id),
  visit_date      date NOT NULL,
  visit_hour      integer NOT NULL CHECK (visit_hour BETWEEN 0 AND 23),
  shift           text,
  mode            text NOT NULL CHECK (mode IN ('package', 'pay')),
  package_id      uuid REFERENCES public.patient_packages(id) ON DELETE SET NULL,
  layanan_id      uuid REFERENCES public.internal_layanan(id) ON DELETE SET NULL,
  service_type    text NOT NULL,
  amount          numeric NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pending_payment'
                  CHECK (status IN ('pending_payment', 'confirmed', 'expired', 'cancelled')),
  expires_at      timestamptz,
  visit_id        uuid REFERENCES public.patient_visits(id) ON DELETE SET NULL,
  payment_link_id uuid REFERENCES public.payment_links(id) ON DELETE SET NULL,
  notes           text,
  CHECK (mode <> 'package' OR package_id IS NOT NULL),
  CHECK (mode <> 'pay' OR layanan_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS online_bookings_slot_idx
  ON public.online_bookings (staff_id, visit_date, visit_hour)
  WHERE status IN ('pending_payment', 'confirmed');
CREATE INDEX IF NOT EXISTS online_bookings_patient_idx
  ON public.online_bookings (patient_id, created_at DESC);

ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS online_booking_id uuid REFERENCES public.online_bookings(id) ON DELETE SET NULL;

ALTER TABLE public.online_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "online_bookings_own_select" ON public.online_bookings;
CREATE POLICY "online_bookings_own_select"
ON public.online_bookings FOR SELECT TO authenticated
USING (patient_id IN (SELECT public.app_my_patient_ids()));

DROP POLICY IF EXISTS "online_bookings_director_select" ON public.online_bookings;
CREATE POLICY "online_bookings_director_select"
ON public.online_bookings FOR SELECT TO authenticated
USING (public.get_my_internal_role() = 'director');

DROP POLICY IF EXISTS "online_bookings_branch_select" ON public.online_bookings;
CREATE POLICY "online_bookings_branch_select"
ON public.online_bookings FOR SELECT TO authenticated
USING (public.get_my_internal_role() IN ('manager', 'admin', 'finance') AND branch_id = public.get_my_branch());

-- ---------------------------------------------------------------------------
-- Account link requests (staff fallback) + auto-link attempt log.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_link_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  profile_id           uuid NOT NULL,
  web_patient_id       uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  encrypted_name       text NOT NULL,
  encrypted_phone      text NOT NULL,
  encrypted_birth_date text,
  phone_hash           text,
  branch_id            uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  note                 text,
  status               text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  matched_patient_id   uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  reviewed_by          uuid REFERENCES public.internal_profiles(id),
  reviewed_at          timestamptz,
  rejection_note       text
);

-- One open request per account.
CREATE UNIQUE INDEX IF NOT EXISTS patient_link_requests_one_pending
  ON public.patient_link_requests (profile_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS patient_link_requests_queue_idx
  ON public.patient_link_requests (status, created_at DESC);

ALTER TABLE public.patient_link_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_link_requests_director_all" ON public.patient_link_requests;
CREATE POLICY "patient_link_requests_director_all"
ON public.patient_link_requests FOR ALL TO authenticated
USING (public.get_my_internal_role() = 'director')
WITH CHECK (public.get_my_internal_role() = 'director');

DROP POLICY IF EXISTS "patient_link_requests_branch_select" ON public.patient_link_requests;
CREATE POLICY "patient_link_requests_branch_select"
ON public.patient_link_requests FOR SELECT TO authenticated
USING (public.get_my_internal_role() IN ('manager', 'admin') AND branch_id = public.get_my_branch());

CREATE TABLE IF NOT EXISTS public.patient_link_attempts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  profile_id uuid NOT NULL,
  success    boolean NOT NULL
);

CREATE INDEX IF NOT EXISTS patient_link_attempts_profile_idx
  ON public.patient_link_attempts (profile_id, created_at DESC);

-- Service role only (no policies).
ALTER TABLE public.patient_link_attempts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- reserve_online_booking: atomically claim a therapist hour (and a package
-- session). Serialized per slot and per package with advisory locks; checks
-- existing visits and live holds. Returns the online_bookings id.
-- Raises: slot_taken | patient_busy | package_full | package_invalid
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_online_booking(
  p_patient      uuid,
  p_profile      uuid,
  p_branch       uuid,
  p_staff        uuid,
  p_date         date,
  p_hour         integer,
  p_shift        text,
  p_mode         text,
  p_package      uuid,
  p_layanan      uuid,
  p_service_type text,
  p_amount       numeric,
  p_expires_at   timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id    uuid;
  v_pkg   record;
  v_used  integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('online-slot:' || p_staff || ':' || p_date || ':' || p_hour));
  PERFORM pg_advisory_xact_lock(hashtext('online-patient:' || p_patient || ':' || p_date || ':' || p_hour));

  IF EXISTS (
    SELECT 1 FROM patient_visits
    WHERE attending_staff_id = p_staff AND visit_date = p_date
      AND extract(hour FROM visit_time) = p_hour AND status <> 'cancelled'
  ) OR EXISTS (
    SELECT 1 FROM online_bookings
    WHERE staff_id = p_staff AND visit_date = p_date AND visit_hour = p_hour
      AND ((status = 'pending_payment' AND expires_at > now()) OR (status = 'confirmed' AND visit_id IS NULL))
  ) THEN
    RAISE EXCEPTION 'slot_taken';
  END IF;

  IF EXISTS (
    SELECT 1 FROM patient_visits
    WHERE patient_id = p_patient AND visit_date = p_date
      AND extract(hour FROM visit_time) = p_hour AND status <> 'cancelled'
  ) OR EXISTS (
    SELECT 1 FROM online_bookings
    WHERE patient_id = p_patient AND visit_date = p_date AND visit_hour = p_hour
      AND ((status = 'pending_payment' AND expires_at > now()) OR (status = 'confirmed' AND visit_id IS NULL))
  ) THEN
    RAISE EXCEPTION 'patient_busy';
  END IF;

  IF p_mode = 'package' THEN
    PERFORM pg_advisory_xact_lock(hashtext('online-package:' || p_package));
    SELECT id, patient_id, total_sessions, COALESCE(legacy_used_sessions, 0) AS legacy, status, category
      INTO v_pkg
    FROM patient_packages WHERE id = p_package;
    IF NOT FOUND OR v_pkg.patient_id <> p_patient OR v_pkg.status <> 'active'
       OR COALESCE(v_pkg.category, 'PAKET KLINIK') <> 'PAKET KLINIK' THEN
      RAISE EXCEPTION 'package_invalid';
    END IF;
    -- Same rule as countBookedSessions (app/actions/packages.ts).
    SELECT count(*) INTO v_used
    FROM patient_visits
    WHERE package_id = p_package AND status <> 'cancelled'
      AND (kehadiran = 'HADIR' OR (status = 'scheduled' AND kehadiran IS NULL));
    IF v_pkg.legacy + v_used >= v_pkg.total_sessions THEN
      RAISE EXCEPTION 'package_full';
    END IF;
  END IF;

  INSERT INTO online_bookings
    (patient_id, profile_id, branch_id, staff_id, visit_date, visit_hour, shift, mode,
     package_id, layanan_id, service_type, amount, status, expires_at)
  VALUES
    (p_patient, p_profile, p_branch, p_staff, p_date, p_hour, p_shift, p_mode,
     p_package, p_layanan, p_service_type, COALESCE(p_amount, 0),
     CASE WHEN p_mode = 'package' THEN 'confirmed' ELSE 'pending_payment' END,
     p_expires_at)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_online_booking(uuid, uuid, uuid, uuid, date, integer, text, text, uuid, uuid, text, numeric, timestamptz)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- link_patient_account: attach the gangsehat.com account owning p_web (its
-- signup patients row) to the clinic record p_target, and move everything the
-- web row owns onto the target. Every FK to patients(id) is repointed
-- generically, so new tables are covered automatically; a row that would
-- break a unique constraint stays on the (deactivated) web row.
-- Raises: web_not_found | target_not_found | target_already_linked
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_patient_account(p_web uuid, p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_web    record;
  v_target record;
  v_fk     record;
  v_pts    record;
BEGIN
  IF p_web = p_target THEN
    UPDATE patients SET account_linked_at = COALESCE(account_linked_at, now()) WHERE id = p_target;
    RETURN;
  END IF;

  SELECT * INTO v_web FROM patients WHERE id = p_web FOR UPDATE;
  IF NOT FOUND OR v_web.profile_id IS NULL THEN RAISE EXCEPTION 'web_not_found'; END IF;
  SELECT * INTO v_target FROM patients WHERE id = p_target FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'target_not_found'; END IF;
  IF v_target.profile_id IS NOT NULL THEN RAISE EXCEPTION 'target_already_linked'; END IF;

  -- Session credits: one row per patient, so merge instead of repointing.
  SELECT total_points, used_points INTO v_pts FROM patient_points WHERE patient_id = p_web;
  IF FOUND THEN
    INSERT INTO patient_points (patient_id, total_points, used_points)
    VALUES (p_target, v_pts.total_points, v_pts.used_points)
    ON CONFLICT (patient_id) DO UPDATE
      SET total_points = patient_points.total_points + EXCLUDED.total_points,
          used_points  = patient_points.used_points + EXCLUDED.used_points,
          updated_at   = now();
    DELETE FROM patient_points WHERE patient_id = p_web;
  END IF;

  -- Repoint every other FK column referencing patients(id).
  FOR v_fk IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.patients'::regclass
      AND array_length(c.conkey, 1) = 1
      AND c.conrelid <> 'public.patient_points'::regclass
      AND c.conrelid <> 'public.patients'::regclass
  LOOP
    BEGIN
      EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', v_fk.tbl, v_fk.col, v_fk.col)
        USING p_target, p_web;
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'link_patient_account: kept %.% rows on web patient (unique conflict)', v_fk.tbl, v_fk.col;
    END;
  END LOOP;

  -- Free the web row's unique values, then attach the account to the target.
  UPDATE patients
  SET profile_id = NULL, referral_code = NULL, is_active = false, updated_at = now()
  WHERE id = p_web;

  UPDATE patients
  SET profile_id        = v_web.profile_id,
      referral_code     = COALESCE(v_target.referral_code, v_web.referral_code),
      member_type_id    = GREATEST(COALESCE(v_target.member_type_id, 1), COALESCE(v_web.member_type_id, 1)),
      last_booking_city = COALESCE(v_target.last_booking_city, v_web.last_booking_city),
      last_location_lat = COALESCE(v_target.last_location_lat, v_web.last_location_lat),
      last_location_lng = COALESCE(v_target.last_location_lng, v_web.last_location_lng),
      account_linked_at = now(),
      updated_at        = now()
  WHERE id = p_target;
END;
$$;

REVOKE ALL ON FUNCTION public.link_patient_account(uuid, uuid) FROM PUBLIC, anon, authenticated;
