-- 013_schedules_rls_self_access.sql
-- Two access patterns for schedules:
--   1. Director + HR  → full access via existing policies (see all staff)
--   2. Everyone else  → own rows only (staff_id = auth.uid())
--
-- Also cleans up the over-permissive branch-wide policies for therapist/staff
-- added in 010–012 that let them see ALL rows in a branch.

-- Remove old broad policies for non-admin roles
DROP POLICY IF EXISTS "schedules: therapist staff read"            ON schedules;
DROP POLICY IF EXISTS "schedules: therapist staff all own branch"  ON schedules;
DROP POLICY IF EXISTS "schedules: therapist staff all"             ON schedules;
DROP POLICY IF EXISTS "schedules: finance marketing read own branch" ON schedules;

-- Self-access: any authenticated user can manage their own schedule rows.
-- This covers therapist, staff, finance, marketing, manager — and even
-- director/hr can still use this path when editing their own schedule.
CREATE POLICY "schedules: self access"
  ON schedules FOR ALL
  USING  (staff_id = auth.uid())
  WITH CHECK (staff_id = auth.uid());
