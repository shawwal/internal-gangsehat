-- ============================================================
-- Migration 008: allow internal staff to read patients
--
-- The existing patients RLS only covers profiles.role
-- (admin / therapist / patient). Internal staff have
-- internal_profiles rows instead of profiles rows, so they are
-- currently blocked from reading any patient data.
--
-- This adds a SELECT-only policy so all active internal staff
-- can list and view patients. Inserts/updates/deletes continue
-- to require an admin profile (gangsehat.com behaviour).
--
-- Patient PII is still protected by AES-256-GCM encryption
-- at the column level; the internal app decrypts server-side
-- using the shared ENCRYPTION_KEY — raw DB access without the
-- key still shows only ciphertext.
-- ============================================================

DROP POLICY IF EXISTS "patients: internal staff read" ON public.patients;

CREATE POLICY "patients: internal staff read"
  ON public.patients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.internal_profiles
      WHERE id = auth.uid() AND is_active = true
    )
  );
