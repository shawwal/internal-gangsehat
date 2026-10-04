-- Migration: patient self-registration queue
--
-- The public site (gangsehat.com/daftar) replaces the Google Form
-- "FORMULIR PENDAFTARAN PASIEN". Submissions land here as `pending`; director,
-- manager and admin review/edit them and either approve (creates a `patients`
-- row, linked via patient_id) or reject (with rejection_note).
--
-- PII (name, phone, address, birth date) is AES-256-GCM encrypted by the public
-- site with the shared ENCRYPTION_KEY — same format as `patients`.
-- Public inserts go through the service role, so there is NO anon policy.
--
-- Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.patient_registrations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  branch_id            uuid NOT NULL REFERENCES public.branches(id),
  encrypted_name       text NOT NULL,
  encrypted_phone      text NOT NULL,
  encrypted_address    text,
  encrypted_birth_date text,
  gender               text CHECK (gender IN ('male', 'female', 'other')),
  agama                text,
  pekerjaan            text,
  hobi                 text,
  keluhan              text,
  kelurahan            text,
  kecamatan            text,
  kabupaten_kota       text,
  provinsi             text,
  status               text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_note       text,
  reviewed_by          uuid REFERENCES public.internal_profiles(id),
  reviewed_at          timestamptz,
  patient_id           uuid REFERENCES public.patients(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS patient_registrations_queue_idx
  ON public.patient_registrations (status, branch_id, created_at DESC);

ALTER TABLE public.patient_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_registrations_director_all" ON public.patient_registrations;
CREATE POLICY "patient_registrations_director_all"
ON public.patient_registrations FOR ALL TO authenticated
USING (public.get_my_internal_role() = 'director')
WITH CHECK (public.get_my_internal_role() = 'director');

DROP POLICY IF EXISTS "patient_registrations_branch_select" ON public.patient_registrations;
CREATE POLICY "patient_registrations_branch_select"
ON public.patient_registrations FOR SELECT TO authenticated
USING (
  public.get_my_internal_role() IN ('manager', 'admin')
  AND branch_id = public.get_my_branch()
);

DROP POLICY IF EXISTS "patient_registrations_branch_update" ON public.patient_registrations;
CREATE POLICY "patient_registrations_branch_update"
ON public.patient_registrations FOR UPDATE TO authenticated
USING (
  public.get_my_internal_role() IN ('manager', 'admin')
  AND branch_id = public.get_my_branch()
)
WITH CHECK (
  public.get_my_internal_role() IN ('manager', 'admin')
  AND branch_id = public.get_my_branch()
);
