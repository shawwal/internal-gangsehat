-- Fix: "infinite recursion detected in policy for relation internal_profiles"
--
-- Root cause: 081-admin-see-cross-branch-therapists.sql added a SELECT policy
-- on internal_profiles whose USING clause queries schedules,
-- schedule_overrides and patient_visits. Those tables' own RLS policies look
-- back at internal_profiles, so evaluating any internal_profiles read (e.g.
-- the UPDATE ... RETURNING on /director/users) loops back into itself.
--
-- Fix: move the cross-table check into a SECURITY DEFINER function so the
-- lookups bypass RLS on those tables and never re-enter internal_profiles
-- policies. Same semantics as 081.
--
-- Run this in your Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.is_scheduled_in_my_branch(p_staff_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.staff_id = p_staff_id AND s.branch_id = get_my_branch()
    )
    OR EXISTS (
      SELECT 1 FROM public.schedule_overrides so
      WHERE so.staff_id = p_staff_id AND so.branch_id = get_my_branch()
    )
    OR EXISTS (
      SELECT 1 FROM public.patient_visits pv
      WHERE pv.attending_staff_id = p_staff_id AND pv.branch_id = get_my_branch()
    );
$$;

REVOKE ALL ON FUNCTION public.is_scheduled_in_my_branch(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_scheduled_in_my_branch(uuid) TO authenticated;

DROP POLICY IF EXISTS "internal_profiles_admin_cross_branch_scheduled_select" ON public.internal_profiles;
CREATE POLICY "internal_profiles_admin_cross_branch_scheduled_select"
ON public.internal_profiles FOR SELECT
USING (
  get_my_internal_role() = 'admin'
  AND public.is_scheduled_in_my_branch(internal_profiles.id)
);
