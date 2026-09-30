-- Security fix: patient_packages and patient_packages_with_stats were readable
-- by the anon (logged-out) role through the REST API, exposing ~1k patient
-- package rows to anyone holding the public publishable key.
--
-- * patient_packages: force RLS on and remove anon access entirely. The internal
--   app only reads it as an authenticated staff user (or via the admin client),
--   and the public gangsehat app never touches it.
-- * patient_packages_with_stats: stop granting it to anon (074/079/080 did).
--   The view still runs as its owner and bypasses RLS (advisor:
--   security_definer_view). Switching to security_invoker would make the
--   payment gate depend on the caller's transactions RLS, so roles without
--   finance access (therapist/staff) would see 0 used sessions. Only flip it
--   after checking every role that reads the view can read the joined tables:
--     ALTER VIEW public.patient_packages_with_stats SET (security_invoker = true);
--
-- Run this in your Supabase SQL editor. Future DROP/CREATE of the view must
-- not re-add the anon GRANT.

ALTER TABLE public.patient_packages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patient_packages FROM anon;

REVOKE ALL ON public.patient_packages_with_stats FROM anon;
GRANT SELECT ON public.patient_packages_with_stats TO authenticated, service_role;
