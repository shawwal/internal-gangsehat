-- Migration: Griya Anak self-registrations
-- Run this in the Supabase SQL editor, after 093.
--
-- gangsehat.com/daftar now shows a child form (replacing the Griya Anak Google
-- Form) when the chosen branch has Griya Anak enabled. Those registrations carry
-- parent + source data and, on approval, become a `patients` row plus a
-- `griya_students` roster row so the child appears in /griya-anak/siswa.
--
--   - patient_registrations.registration_type  'umum' | 'griya' (set by the
--     public site from branch_griya_settings, never by the visitor)
--   - patient_registrations parent / source / nickname columns (same names as
--     the patients columns from migration 073)
--   - patients.nama_panggilan  child's nickname (Griya Anak)
--
-- No RLS change: both tables keep their existing policies.

ALTER TABLE public.patient_registrations
  ADD COLUMN IF NOT EXISTS registration_type text NOT NULL DEFAULT 'umum'
    CHECK (registration_type IN ('umum', 'griya')),
  ADD COLUMN IF NOT EXISTS nama_panggilan text,
  ADD COLUMN IF NOT EXISTS nama_ibu       text,
  ADD COLUMN IF NOT EXISTS pekerjaan_ibu  text,
  ADD COLUMN IF NOT EXISTS nama_ayah      text,
  ADD COLUMN IF NOT EXISTS pekerjaan_ayah text,
  ADD COLUMN IF NOT EXISTS sumber         text;

-- Registrations submitted before this migration were typed by branch.
UPDATE public.patient_registrations r
SET registration_type = 'griya'
FROM public.branch_griya_settings g
WHERE g.branch_id = r.branch_id AND g.enabled AND r.registration_type = 'umum';

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS nama_panggilan text;
