-- View: patient_packages_with_stats
-- Adds computed used_sessions and remaining_sessions by counting non-cancelled
-- patient_visits linked to each package via package_id.
-- Run this in your Supabase SQL editor.

CREATE OR REPLACE VIEW public.patient_packages_with_stats AS
SELECT
  pp.*,
  COALESCE(vc.used_sessions, 0)                          AS used_sessions,
  pp.total_sessions - COALESCE(vc.used_sessions, 0)      AS remaining_sessions
FROM public.patient_packages pp
LEFT JOIN (
  SELECT package_id, COUNT(*) AS used_sessions
  FROM public.patient_visits
  WHERE status != 'cancelled'
    AND package_id IS NOT NULL
  GROUP BY package_id
) vc ON pp.id = vc.package_id;
