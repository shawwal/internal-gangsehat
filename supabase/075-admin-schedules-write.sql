-- Migration: give the "admin" role write access to schedules (Master Jadwal)
-- Run this in the Supabase SQL editor.
--
-- Root cause: migration 035 only granted admin a SELECT policy on
-- public.schedules ("schedules_admin_own_branch_select"). The /hr/schedules
-- page lets admin add / edit / bulk-edit / delete staff schedules, but every
-- INSERT/UPDATE/DELETE is rejected by RLS with
--   "new row violates row-level security policy for table \"schedules\""
-- because the only write policy that could match for admin is
-- "schedules: self access" (staff_id = auth.uid()), which never applies when
-- managing other staff's rows.
--
-- Fix: replace the SELECT-only policy with a FOR ALL own-branch policy,
-- mirroring "transactions_admin_own_branch" (migration 027) and the
-- hr/manager "all own branch" policies on this table. Admin stays
-- branch-scoped: it can only touch schedule rows whose branch_id matches
-- the admin's own branch.

DROP POLICY IF EXISTS "schedules_admin_own_branch_select" ON public.schedules;

CREATE POLICY "schedules_admin_own_branch"
ON public.schedules FOR ALL
USING (
  get_my_internal_role() = 'admin'
  AND branch_id = get_my_branch()
)
WITH CHECK (
  get_my_internal_role() = 'admin'
  AND branch_id = get_my_branch()
);
