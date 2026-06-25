-- View: patient_packages_with_stats
-- used_sessions = legacy sessions migrated from old system + new visits linked via package_id
-- remaining_sessions = total_sessions - used_sessions
-- As therapists add new patient_visits with package_id set, the live count grows on top
-- of legacy_used_sessions automatically — no manual updates needed after migration.
-- Run this in your Supabase SQL editor.

DROP VIEW IF EXISTS public.patient_packages_with_stats;
CREATE VIEW public.patient_packages_with_stats AS
SELECT
  pp.*,
  pp.legacy_used_sessions + COALESCE(vc.used_sessions, 0)                                    AS used_sessions,
  pp.total_sessions - (pp.legacy_used_sessions + COALESCE(vc.used_sessions, 0))              AS remaining_sessions
FROM public.patient_packages pp
LEFT JOIN (
  SELECT package_id, COUNT(*) AS used_sessions
  FROM public.patient_visits
  WHERE status != 'cancelled'
    AND package_id IS NOT NULL
  GROUP BY package_id
) vc ON pp.id = vc.package_id;
