-- 1 patient = 1 active order: a patient may not have two 'active' packages
-- at once. Adds a distinct 'stopped' terminal status (admin-initiated stop of
-- an in-progress order, separate from 'completed'/'cancelled') plus a DB-level
-- guard as defense in depth against the app-level check in
-- app/actions/packages.ts::createPatientPackage/createPackageFromLayanan.
--
-- Written to be safely re-runnable: the Supabase SQL editor does not wrap a
-- multi-statement submission in a single transaction, so a failure partway
-- through (e.g. the unique index below) can leave earlier ALTERs already
-- committed. Every step here is idempotent — re-running after a partial
-- failure just skips what already applied.
-- Run this in your Supabase SQL editor.

ALTER TABLE public.patient_packages
  DROP CONSTRAINT IF EXISTS patient_packages_status_check,
  ADD CONSTRAINT patient_packages_status_check
    CHECK (status = ANY (ARRAY['active','completed','cancelled','stopped']::text[]));

ALTER TABLE public.patient_packages
  ADD COLUMN IF NOT EXISTS stopped_at date,
  ADD COLUMN IF NOT EXISTS stopped_by uuid REFERENCES public.internal_profiles(id);

-- Pre-existing data may already have a patient with more than one 'active'
-- package (the old code never enforced this). Reconcile before the unique
-- index below: keep only the most recently created package active per
-- patient, and STOP the rest — status changes only, nothing is deleted and
-- history/session/payment records are untouched.
WITH ranked AS (
  SELECT id, patient_id,
         ROW_NUMBER() OVER (PARTITION BY patient_id ORDER BY created_at DESC) AS rn
  FROM public.patient_packages
  WHERE status = 'active'
)
UPDATE public.patient_packages pp
SET status             = 'stopped',
    operational_status = 'OFF',
    stopped_at          = CURRENT_DATE,
    updated_at          = now()
FROM ranked
WHERE pp.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS patient_packages_one_active_per_patient
  ON public.patient_packages (patient_id)
  WHERE status = 'active';
