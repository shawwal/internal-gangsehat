-- Migration: visit preference on public registrations
--
-- gangsehat.com/daftar now asks Fisioterapi (umum) registrants whether they
-- will come to the clinic or want a home visit. Shown on the Pendaftaran
-- Pasien card so staff schedule it in Jadwal Harian or Home Visit.
-- NULL = Griya Anak registrations and rows submitted before this migration.
--
-- Reference copy: gangsehat repo supabase/migrations/052_registration_visit_type.sql

ALTER TABLE public.patient_registrations
  ADD COLUMN IF NOT EXISTS visit_type text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_registrations_visit_type_check') THEN
    ALTER TABLE public.patient_registrations ADD CONSTRAINT patient_registrations_visit_type_check
      CHECK (visit_type IS NULL OR visit_type IN ('clinic', 'home_visit'));
  END IF;
END;
$$;
