-- Run only after 056-sport-massage-role.sql has committed.
-- Adds 'SPORT MASSAGE' to the patient_visits.service_type CHECK constraint.
-- service_type is a plain CHECK, not a Postgres enum, so this can run in
-- the same transaction as everything else — no ADD VALUE-style
-- restriction applies here.
--
-- Verify the constraint name against the live DB (\d patient_visits)
-- before running — patient_visits_service_type_check is Postgres's
-- default auto-generated name and matches schema_public.sql, but confirm
-- rather than assume before executing in production.

ALTER TABLE public.patient_visits DROP CONSTRAINT patient_visits_service_type_check;

ALTER TABLE public.patient_visits
  ADD CONSTRAINT patient_visits_service_type_check
  CHECK (service_type = ANY (ARRAY[
    'TERAPI AWAL','PAKET TERAPI','SESI TERAPI',
    'TA VISIT','SESI VISIT','PAKET VISIT',
    'SPORT MASSAGE','LAINNYA'
  ]::text[]));
