-- Run this file ALONE in the Supabase SQL editor and let it commit before
-- running 057-sport-massage-service-type.sql or any app code that writes
-- the literal 'sport_massage_therapist' to internal_profiles.role —
-- Postgres cannot use a new enum value in the same transaction it was
-- added in (error 55P04), same constraint documented in
-- 027-admin-role.sql / 028-non-staff-role.sql.
--
-- No new RLS policies are needed for this role: every policy on
-- patient_visits, attendance, leave_requests, staff_targets, schedules,
-- and transactions scopes by branch_id/staff_id/auth.uid(), not by the
-- literal string 'therapist' — this role automatically gets the same
-- "own row / own branch" access therapist/staff already have.

ALTER TYPE internal_user_role ADD VALUE IF NOT EXISTS 'sport_massage_therapist';
