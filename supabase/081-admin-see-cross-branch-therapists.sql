-- Migration: let admin see therapist names when they're scheduled in the
-- admin's branch but their own internal_profiles.branch_id points elsewhere
-- (e.g. a therapist covering a shift at another branch).
--
-- Root cause: 035-admin-jadwal-harian-access.sql only granted admin SELECT
-- on internal_profiles where the THERAPIST'S OWN branch_id matches the
-- admin's branch. jadwal-harian shows staff by schedules.branch_id /
-- schedule_overrides.branch_id / patient_visits.branch_id, which can differ
-- from the therapist's home branch_id for a covering shift. RLS then blocks
-- the embedded internal_profiles join, so ScheduleCalendarView/useJadwalHarian
-- fall back to 'Unknown' for that therapist even though their schedule row
-- is visible to the admin.

CREATE POLICY "internal_profiles_admin_cross_branch_scheduled_select"
ON public.internal_profiles FOR SELECT
USING (
  get_my_internal_role() = 'admin'
  AND (
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.staff_id = internal_profiles.id
        AND s.branch_id = get_my_branch()
    )
    OR EXISTS (
      SELECT 1 FROM public.schedule_overrides so
      WHERE so.staff_id = internal_profiles.id
        AND so.branch_id = get_my_branch()
    )
    OR EXISTS (
      SELECT 1 FROM public.patient_visits pv
      WHERE pv.attending_staff_id = internal_profiles.id
        AND pv.branch_id = get_my_branch()
    )
  )
);
