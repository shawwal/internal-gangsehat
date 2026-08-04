-- Fix: patient_packages_with_stats.used_sessions was undercounting.
-- `kehadiran != 'TIDAK HADIR'` evaluates to NULL (not TRUE) when kehadiran IS NULL,
-- so any visit whose attendance was never explicitly recorded was silently dropped
-- from the count — even though only an explicit no-show should be excluded.
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
    AND (kehadiran IS NULL OR kehadiran != 'TIDAK HADIR')
  GROUP BY package_id
) vc ON pp.id = vc.package_id;
