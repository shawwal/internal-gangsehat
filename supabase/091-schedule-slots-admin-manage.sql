-- Migration: let admin manage schedule_slots for their own branch
--
-- Slot Jadwal (/director/schedule-slots) was director-only. Admin is the
-- branch-scoped operational role that runs the daily schedule, so they can now
-- add/edit/disable/delete slots too — limited to their own branch. Director
-- keeps full cross-branch access via "schedule_slots_director_manage".
--
-- Run this in the Supabase SQL editor.

DROP POLICY IF EXISTS "schedule_slots_admin_manage" ON public.schedule_slots;

CREATE POLICY "schedule_slots_admin_manage"
ON public.schedule_slots FOR ALL TO authenticated
USING (
  public.get_my_internal_role() = 'admin'
  AND branch_id = public.get_my_branch()
)
WITH CHECK (
  public.get_my_internal_role() = 'admin'
  AND branch_id = public.get_my_branch()
);
