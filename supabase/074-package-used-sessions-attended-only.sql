-- Fix: patient_packages_with_stats counted scheduled-but-not-yet-attended
-- sessions as "used".
--
-- Sessions for a package are created up-front on the calendar (one
-- patient_visits row per booked session, kehadiran = NULL). Since migration
-- 050 the view counted any linked visit that was not an explicit no-show
-- (`kehadiran IS NULL OR kehadiran != 'TIDAK HADIR'`), so a freshly-scheduled
-- 3-session package immediately showed 3/3 used, 0 remaining.
--
-- A session now only counts toward used_sessions once its visit is marked
-- kehadiran = 'HADIR' (griya markAttendance also sets status = 'completed'
-- alongside kehadiran, so the HADIR check covers it). The package-level
-- payment gate from 059 is kept unchanged (unpaid package => 0 used).
--
-- New column: scheduled_sessions — linked visits booked ahead but not yet
-- attended. Display only ("N terjadwal"); NOT deducted from remaining_sessions.
--
-- Run this in your Supabase SQL editor.

DROP VIEW IF EXISTS public.patient_packages_with_stats;
CREATE VIEW public.patient_packages_with_stats AS
WITH attended_counts AS (
  SELECT package_id, COUNT(*) AS cnt
  FROM public.patient_visits
  WHERE package_id IS NOT NULL
    AND status <> 'cancelled'
    AND kehadiran = 'HADIR'
  GROUP BY package_id
),
scheduled_counts AS (
  SELECT package_id, COUNT(*) AS cnt
  FROM public.patient_visits
  WHERE package_id IS NOT NULL
    AND status NOT IN ('cancelled', 'rescheduled', 'no_show')
    AND kehadiran IS NULL
  GROUP BY package_id
),
package_payments AS (
  SELECT pp.id AS package_id
  FROM public.patient_packages pp
  WHERE EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.status = 'confirmed'
      AND (
        t.order_id = pp.order_id
        OR t.visit_id IN (SELECT id FROM public.patient_visits WHERE package_id = pp.id)
      )
  )
)
SELECT
  pp.*,
  pp.legacy_used_sessions
    + COALESCE(CASE WHEN pay.package_id IS NOT NULL THEN ac.cnt ELSE 0 END, 0)                        AS used_sessions,
  pp.total_sessions - (
    pp.legacy_used_sessions
    + COALESCE(CASE WHEN pay.package_id IS NOT NULL THEN ac.cnt ELSE 0 END, 0)
  )                                                                                                  AS remaining_sessions,
  COALESCE(sc.cnt, 0)                                                                                AS scheduled_sessions
FROM public.patient_packages pp
LEFT JOIN attended_counts  ac  ON pp.id = ac.package_id
LEFT JOIN scheduled_counts sc  ON pp.id = sc.package_id
LEFT JOIN package_payments pay ON pp.id = pay.package_id;

GRANT SELECT ON public.patient_packages_with_stats TO anon, authenticated, service_role;
