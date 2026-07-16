-- Migration: fix admin access to /jadwal-harian (daily schedule grid)
-- Run this in the Supabase SQL editor.
--
-- Root cause: the "admin" role (added in 027-admin-role.sql) was only given
-- access to transactions and a view-only look at leave_requests. It never
-- got a SELECT policy on internal_profiles, schedules, or schedule_overrides,
-- so the jadwal-harian page's queries for "which therapists are scheduled
-- today" silently return zero rows for admin (internal_profiles RLS falls
-- back to "own row only" per CLAUDE.md), making the page look empty/broken
-- even though the route itself is reachable.
--
-- Mirrors the existing manager/hr "own branch" read access — admin stays
-- branch-scoped and read-only on staff profiles/schedules (no ability to
-- edit other staff's schedule or profile rows).

CREATE POLICY "internal_profiles_admin_own_branch_select"
ON public.internal_profiles FOR SELECT
USING (
  get_my_internal_role() = 'admin'
  AND branch_id = get_my_branch()
);

CREATE POLICY "schedules_admin_own_branch_select"
ON public.schedules FOR SELECT
USING (
  get_my_internal_role() = 'admin'
  AND branch_id = get_my_branch()
);

CREATE POLICY "schedule_overrides_admin_own_branch_select"
ON public.schedule_overrides FOR SELECT
USING (
  get_my_internal_role() = 'admin'
  AND branch_id = get_my_branch()
);
