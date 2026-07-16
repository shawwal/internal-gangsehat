-- Migration: revert 032-add-layanan-id-to-visits.sql
-- The "Satu Sesi" service/price picker (Sport Massage etc.) is being reverted —
-- Sport Massage will instead be scheduled with its own therapist rather than
-- picked as a sub-service on an existing visit. Only run this if
-- 032-add-layanan-id-to-visits.sql was already applied to this database.

DROP INDEX IF EXISTS public.idx_patient_visits_layanan_id;

ALTER TABLE public.patient_visits
  DROP COLUMN IF EXISTS layanan_id;
