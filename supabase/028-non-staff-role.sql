-- Adds a no-access placeholder role for new signups; 'staff' becomes a real
-- therapist-equivalent working role once assigned by a director/admin.
--
-- Run this file ALONE in the Supabase SQL editor and let it commit before
-- running 029-non-staff-role-policies.sql. Postgres cannot use a new enum
-- value in the same transaction it was added in (error 55P04), so the two
-- files must be executed as separate SQL-editor runs, in order.

ALTER TYPE internal_user_role ADD VALUE IF NOT EXISTS 'non-staff';
