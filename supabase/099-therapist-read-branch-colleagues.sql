-- Therapists need to see who else treats a patient (Riwayat Kunjungan pasien,
-- List Jadwal) to coordinate care. Until now therapist/staff could only read
-- their OWN internal_profiles row ("ip: own read"), so every embedded
-- internal_profiles!attending_staff_id(...) for a colleague came back NULL and
-- the Terapis / Fisio column showed "—".
--
-- Grants SELECT on colleagues in the caller's branch, plus therapists from
-- another branch who are scheduled / have visits in the caller's branch (same
-- rule admin got in 081/083, via the SECURITY DEFINER helper so no policy
-- recursion). Read-only; updates stay "own update" only.
--
-- Run this in your Supabase SQL editor.

DROP POLICY IF EXISTS "ip: clinical staff read branch colleagues" ON public.internal_profiles;
CREATE POLICY "ip: clinical staff read branch colleagues"
ON public.internal_profiles FOR SELECT
USING (
  get_my_internal_role() IN ('therapist', 'staff', 'sport_massage_therapist')
  AND (
    branch_id = get_my_branch()
    OR public.is_scheduled_in_my_branch(internal_profiles.id)
  )
);
