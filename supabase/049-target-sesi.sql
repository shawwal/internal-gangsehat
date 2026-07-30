-- Migration: add "Sesi" as a 5th target category alongside TA, Paket Klinik,
-- Kunjungan, and Visit. Sesi = a patient attending a single paid session
-- (SESI TERAPI / SESI VISIT service_type), tracked the same way as the
-- existing target_* columns.

ALTER TABLE public.staff_targets  ADD COLUMN target_sesi integer NOT NULL DEFAULT 0;
ALTER TABLE public.branch_targets ADD COLUMN target_sesi integer NOT NULL DEFAULT 0;
