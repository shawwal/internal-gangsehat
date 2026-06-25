-- Migration: add legacy_used_sessions to patient_packages
-- This stores session counts migrated from the old system (dewasa.fisioterapigangsehat.id).
-- The patient_packages_with_stats view adds this to live patient_visits counts.
ALTER TABLE public.patient_packages
  ADD COLUMN IF NOT EXISTS legacy_used_sessions INT NOT NULL DEFAULT 0;
