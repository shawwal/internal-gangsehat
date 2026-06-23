-- Run this in Supabase SQL Editor to allow internal staff to register new patients.
-- The patients table currently only allows insert by the public 'admin' role (gangsehat.com app).
-- This adds an INSERT policy for authenticated internal staff (internal_profiles).

CREATE POLICY "internal_staff_can_insert_patients"
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.internal_profiles
    WHERE id = auth.uid()
    AND is_active = true
  )
);
