-- 012_schedules_rls_fix_null_branch.sql
-- Fix: therapist/staff with NULL branch_id (no branch assigned) were blocked by
-- the policy `branch_id = get_my_branch()` because NULL = NULL is always false in SQL.
-- Now: if the user has no branch they see all schedules (same as director fallback).

-- Drop current therapist/staff policies from 010 and 011
DROP POLICY IF EXISTS "schedules: therapist staff read"            ON schedules;
DROP POLICY IF EXISTS "schedules: therapist staff all own branch"  ON schedules;

-- Recreate: own branch when assigned, all branches when unassigned
CREATE POLICY "schedules: therapist staff all"
  ON schedules FOR ALL
  USING (
    get_my_internal_role() IN ('therapist', 'staff')
    AND (
      get_my_branch() IS NULL           -- no branch assigned → see/edit all
      OR branch_id = get_my_branch()    -- branch assigned → own branch only
    )
  )
  WITH CHECK (
    get_my_internal_role() IN ('therapist', 'staff')
    AND (
      get_my_branch() IS NULL
      OR branch_id = get_my_branch()
    )
  );

-- Same fix for hr and manager (defensive, in case branch is ever NULL)
DROP POLICY IF EXISTS "schedules: hr all own branch"      ON schedules;
DROP POLICY IF EXISTS "schedules: manager all own branch" ON schedules;

CREATE POLICY "schedules: hr all"
  ON schedules FOR ALL
  USING (
    get_my_internal_role() = 'hr'
    AND (
      get_my_branch() IS NULL
      OR branch_id = get_my_branch()
    )
  )
  WITH CHECK (
    get_my_internal_role() = 'hr'
    AND (
      get_my_branch() IS NULL
      OR branch_id = get_my_branch()
    )
  );

CREATE POLICY "schedules: manager all"
  ON schedules FOR ALL
  USING (
    get_my_internal_role() = 'manager'
    AND (
      get_my_branch() IS NULL
      OR branch_id = get_my_branch()
    )
  )
  WITH CHECK (
    get_my_internal_role() = 'manager'
    AND (
      get_my_branch() IS NULL
      OR branch_id = get_my_branch()
    )
  );
