-- 011_schedules_rls_all_roles.sql
-- Grant all staff roles write access to schedules (own branch)

-- Drop the old read-only policy for therapist/staff
DROP POLICY IF EXISTS "schedules: therapist staff read" ON schedules;

-- Replace with full access on own branch for therapist + staff
CREATE POLICY "schedules: therapist staff all own branch"
  ON schedules FOR ALL
  USING (
    get_my_internal_role() IN ('therapist', 'staff')
    AND branch_id = get_my_branch()
  )
  WITH CHECK (
    get_my_internal_role() IN ('therapist', 'staff')
    AND branch_id = get_my_branch()
  );

-- Finance + marketing can also read schedules (view-only, informational)
CREATE POLICY "schedules: finance marketing read own branch"
  ON schedules FOR SELECT
  USING (
    get_my_internal_role() IN ('finance', 'marketing')
    AND branch_id = get_my_branch()
  );
