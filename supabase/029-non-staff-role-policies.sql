-- Run this AFTER 028-non-staff-role.sql has committed (separate SQL-editor
-- execution). Sets the new 'non-staff' value as the default role for new
-- registrations, and restricts the previously role-agnostic patients INSERT
-- policy so unapproved ('non-staff') users cannot register patients.

ALTER TABLE public.internal_profiles
  ALTER COLUMN role SET DEFAULT 'non-staff';

DROP POLICY IF EXISTS "internal_staff_can_insert_patients" ON public.patients;
CREATE POLICY "internal_staff_can_insert_patients"
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.internal_profiles
    WHERE id = auth.uid()
    AND is_active = true
    AND role <> 'non-staff'
  )
);
