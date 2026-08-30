-- Migration: dedicated parent + source columns on patients (Griya Anak siswa)
-- Run this in the Supabase SQL editor, after 072.
--
-- The Griya Anak student roster / detail page is now the system of record for
-- these children. The "PASIEN" sheet of FT-KLINIK GRIYA ANAK.xlsx carries
-- Nama Ibu / Pekerjaan Ibu / Nama Ayah / Pekerjaan Ayah / Sumber — previously
-- folded into medical_notes as free text. Promote them to real columns so the
-- Ubah Data form can edit them.
--
-- No RLS change needed: 072-patients-internal-update.sql already grants
-- director/manager/admin/hr UPDATE on patients, and column reads inherit the
-- table SELECT policy.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS nama_ibu       text,
  ADD COLUMN IF NOT EXISTS pekerjaan_ibu  text,
  ADD COLUMN IF NOT EXISTS nama_ayah      text,
  ADD COLUMN IF NOT EXISTS pekerjaan_ayah text,
  ADD COLUMN IF NOT EXISTS sumber         text;
