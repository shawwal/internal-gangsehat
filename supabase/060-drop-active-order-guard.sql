-- Reverts the "1 patient = 1 active order" DB-level guard added in
-- 054-package-stop-and-active-guard.sql. Staff/admin should be able to sell a
-- patient a new package even while an existing one is still active/unfinished
-- — the app-level check in app/actions/packages.ts::createPatientPackage/
-- createPackageFromLayanan has been removed to match.
--
-- The 'stopped' status, stopped_at/stopped_by columns, and the STOP order
-- action are left intact — only the single-active-package enforcement goes.
--
-- Idempotent — safe to re-run. Run this in your Supabase SQL editor.

DROP INDEX IF EXISTS public.patient_packages_one_active_per_patient;
