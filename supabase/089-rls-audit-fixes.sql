-- Fixes from rls-audit.sql (run after 088).
--
-- This Supabase project is shared with the public gangsehat app, so role
-- `authenticated` includes public patient accounts, not just internal staff.
-- Policies with USING (true) TO authenticated therefore let any patient who
-- signs up on gangsehat.com read/write internal data. Gate them on having an
-- internal profile (get_my_internal_role() is NULL for non-internal users).
--
-- Run this in your Supabase SQL editor.

-- booking_payments / booking_sessions: were full read/write for any logged-in user
DROP POLICY IF EXISTS internal_staff_booking_payments ON public.booking_payments;
CREATE POLICY internal_staff_booking_payments ON public.booking_payments
  FOR ALL TO authenticated
  USING (public.get_my_internal_role() IS NOT NULL)
  WITH CHECK (public.get_my_internal_role() IS NOT NULL);

DROP POLICY IF EXISTS internal_staff_booking_sessions ON public.booking_sessions;
CREATE POLICY internal_staff_booking_sessions ON public.booking_sessions
  FOR ALL TO authenticated
  USING (public.get_my_internal_role() IS NOT NULL)
  WITH CHECK (public.get_my_internal_role() IS NOT NULL);

-- diagnoses: shared lookup list; only internal staff may read or add entries
DROP POLICY IF EXISTS diagnoses_select_all ON public.diagnoses;
CREATE POLICY diagnoses_select_all ON public.diagnoses
  FOR SELECT TO authenticated
  USING (public.get_my_internal_role() IS NOT NULL);

DROP POLICY IF EXISTS diagnoses_insert_all ON public.diagnoses;
CREATE POLICY diagnoses_insert_all ON public.diagnoses
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_internal_role() IS NOT NULL);

-- role_page_permissions: internal app config, not for public patients
DROP POLICY IF EXISTS "rpp: staff read" ON public.role_page_permissions;
CREATE POLICY "rpp: staff read" ON public.role_page_permissions
  FOR SELECT TO authenticated
  USING (public.get_my_internal_role() IS NOT NULL);

-- SECURITY DEFINER functions: pin search_path (advisor: function_search_path_mutable)
ALTER FUNCTION public.get_my_branch() SET search_path = public;
ALTER FUNCTION public.get_my_internal_role() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
