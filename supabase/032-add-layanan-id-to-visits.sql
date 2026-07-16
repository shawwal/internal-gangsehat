-- Migration: link patient_visits to a specific internal_layanan row
-- Lets "Satu Sesi" (no-package) visits record exactly which priced service
-- (e.g. a new SESI KLINIK sub-type like "Sport Massage") was chosen, instead
-- of PaymentDialog silently guessing the oldest row in the category.
-- See app/actions/transactions.ts fetchLayananHarga and components/jadwal/
-- assign/LayananSearchPicker.tsx.

ALTER TABLE public.patient_visits
  ADD COLUMN IF NOT EXISTS layanan_id uuid REFERENCES public.internal_layanan(id);

CREATE INDEX IF NOT EXISTS idx_patient_visits_layanan_id ON public.patient_visits(layanan_id);
