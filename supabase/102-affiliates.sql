-- Copy of gangsehat supabase/migrations/046_affiliates.sql — already applied to
-- the shared DB on 2026-10-09; kept here so this repo's SQL history is complete.

-- Migration: affiliate program
--
-- Shared DB with internal-gangsehat (same as patient_registrations, internal
-- migrations 093/094). Run this in the Supabase SQL editor.
--
--   - affiliates: sign-ups from gangsehat.com/daftar/afiliasi. Each gets a unique
--     `code` at sign-up; it only works on the patient form once status is
--     'approved' (reviewed by a director in the internal system).
--   - patient_registrations.affiliate_id / affiliate_code: the code a patient
--     entered (or arrived with via /daftar?ref=CODE), checked by the public site.
--
-- PII (name, phone, account number) is AES-256-GCM encrypted by the public site
-- with the shared ENCRYPTION_KEY. Public inserts go through the service role,
-- so there is NO anon policy.

CREATE TABLE IF NOT EXISTS public.affiliates (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  code                     text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{4,20}$'),
  encrypted_name           text NOT NULL,
  encrypted_phone          text NOT NULL,
  email                    text,
  domisili                 text,
  pekerjaan                text,
  social_media             text,
  bank_name                text NOT NULL,
  encrypted_account_number text NOT NULL,
  account_holder           text NOT NULL,
  motivasi                 text,
  status                   text NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'approved', 'rejected', 'inactive')),
  rejection_note           text,
  reviewed_by              uuid REFERENCES public.internal_profiles(id),
  reviewed_at              timestamptz
);

CREATE INDEX IF NOT EXISTS affiliates_queue_idx
  ON public.affiliates (status, created_at DESC);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "affiliates_director_all" ON public.affiliates;
CREATE POLICY "affiliates_director_all"
ON public.affiliates FOR ALL TO authenticated
USING (public.get_my_internal_role() = 'director')
WITH CHECK (public.get_my_internal_role() = 'director');

-- Managers/admins see affiliates so they can tell who referred a registration.
DROP POLICY IF EXISTS "affiliates_staff_select" ON public.affiliates;
CREATE POLICY "affiliates_staff_select"
ON public.affiliates FOR SELECT TO authenticated
USING (public.get_my_internal_role() IN ('manager', 'admin'));

ALTER TABLE public.patient_registrations
  ADD COLUMN IF NOT EXISTS affiliate_id   uuid REFERENCES public.affiliates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS affiliate_code text;

CREATE INDEX IF NOT EXISTS patient_registrations_affiliate_idx
  ON public.patient_registrations (affiliate_id)
  WHERE affiliate_id IS NOT NULL;
