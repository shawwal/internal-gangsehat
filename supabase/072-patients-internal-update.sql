-- Migration: let internal management roles UPDATE patients
-- Run this in the Supabase SQL editor.
--
-- patients has SELECT (all internal staff) and INSERT (role <> 'non-staff')
-- policies, but the only UPDATE policies are for the patient-facing app
-- ("Patients can update own preferences", profile_id = auth.uid()) and a
-- stale "Admins have full access" that checks the consumer public.profiles /
-- user_role schema — which no internal user satisfies. So editing a patient
-- from the dashboard silently no-ops under RLS.
--
-- This adds the missing internal UPDATE policy. Scope matches who edits
-- patients today (director/manager on /patients/[id]/edit) plus admin/hr,
-- which the Griya Anak student detail page needs.

CREATE POLICY "internal_mgmt_can_update_patients"
ON public.patients FOR UPDATE
TO authenticated
USING (public.get_my_internal_role() IN ('director', 'manager', 'admin', 'hr'))
WITH CHECK (public.get_my_internal_role() IN ('director', 'manager', 'admin', 'hr'));
