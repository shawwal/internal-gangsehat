-- Fix: packages showing impossible counts like "22/20 · 6 terjadwal".
--
-- Visits marked "completed" through the quick status action (updateVisitStatus,
-- also used by home-visit) never had kehadiran set, so they stayed NULL. The
-- view (080) only counted kehadiran = 'HADIR' as used and treated ANY
-- non-cancelled visit with kehadiran IS NULL as "terjadwal" — so past,
-- completed sessions showed up as still scheduled and never consumed quota.
-- Meanwhile the app-side capacity count (countBookedSessions) also included
-- TIDAK HADIR visits, which the view never counts, so the jadwal package
-- dropdown showed more sessions than the package has.
--
-- New rules (mirrored in countBookedSessions, app/actions/packages.ts):
--   used      = not cancelled AND (kehadiran = 'HADIR'
--                                  OR (status = 'completed' AND kehadiran IS NULL))
--   scheduled = status = 'scheduled' AND kehadiran IS NULL
--   TIDAK HADIR / no_show / cancelled / rescheduled never consume a session.
--
-- Payment gate, columns and grants are unchanged from 080/088.
--
-- Run this in your Supabase SQL editor.

CREATE OR REPLACE VIEW public.patient_packages_with_stats AS
WITH attended_counts AS (
  SELECT package_id, COUNT(*) AS cnt
  FROM public.patient_visits
  WHERE package_id IS NOT NULL
    AND status <> 'cancelled'
    AND (
      kehadiran = 'HADIR'
      OR (status = 'completed' AND kehadiran IS NULL)
    )
  GROUP BY package_id
),
scheduled_counts AS (
  SELECT package_id, COUNT(*) AS cnt
  FROM public.patient_visits
  WHERE package_id IS NOT NULL
    AND status = 'scheduled'
    AND kehadiran IS NULL
  GROUP BY package_id
),
package_payments AS (
  SELECT pp.id AS package_id
  FROM public.patient_packages pp
  WHERE pp.order_id IS NULL
     OR EXISTS (
       SELECT 1 FROM public.transactions t
       WHERE t.status <> 'rejected'
         AND t.amount > 0
         AND (
           t.order_id = pp.order_id
           OR t.visit_id IN (SELECT id FROM public.patient_visits WHERE package_id = pp.id)
         )
     )
)
SELECT
  pp.*,
  pay.package_id IS NOT NULL AS payment_ok,
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

REVOKE ALL ON public.patient_packages_with_stats FROM anon;
GRANT SELECT ON public.patient_packages_with_stats TO authenticated, service_role;

-- Optional data cleanup (NOT run by default): give existing completed visits an
-- explicit kehadiran so the jadwal/visit UI shows "HADIR" for them too. Not
-- needed for package counts — the view above already handles NULL. Note it
-- would also raise kehadiran='HADIR' based counts (Griya performa, unlocked
-- PFOTM/payroll periods) for those historical visits.
--
-- UPDATE public.patient_visits
-- SET kehadiran = 'HADIR', updated_at = now()
-- WHERE status = 'completed' AND kehadiran IS NULL;
