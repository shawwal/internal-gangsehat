-- Fix: packages showing impossible counts like "22/20 · 6 terjadwal".
--
-- Two bugs:
--  1. The view (080) labelled ANY non-cancelled visit with kehadiran IS NULL as
--     "terjadwal". Visits closed via the status dropdown before the "Tandai
--     Hadir" button existed (pre Aug 2026) are status = 'completed' with no
--     kehadiran, so past visits showed up as still scheduled.
--  2. The app-side capacity count (countBookedSessions) counted every
--     non-cancelled visit, including TIDAK HADIR and those unrecorded ones,
--     so the jadwal package dropdown showed more sessions than the package has.
--
-- Rules (mirrored in countBookedSessions, app/actions/packages.ts):
--   used       = not cancelled AND kehadiran = 'HADIR'   (only real attendance
--                consumes quota — TIDAK HADIR never does)
--   scheduled  = status = 'scheduled' AND kehadiran IS NULL
--   unrecorded = status = 'completed' AND kehadiran IS NULL — closed without
--                attendance being recorded; does NOT consume quota, surfaced
--                so staff can set Hadir / Tidak Hadir on the session.
--
-- Payment gate and grants are unchanged from 080/088. unrecorded_sessions is
-- appended as the last column so CREATE OR REPLACE keeps dependents intact.
--
-- Run this in your Supabase SQL editor.

CREATE OR REPLACE VIEW public.patient_packages_with_stats AS
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
    AND status = 'scheduled'
    AND kehadiran IS NULL
  GROUP BY package_id
),
unrecorded_counts AS (
  SELECT package_id, COUNT(*) AS cnt
  FROM public.patient_visits
  WHERE package_id IS NOT NULL
    AND status = 'completed'
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
  COALESCE(sc.cnt, 0)                                                                                AS scheduled_sessions,
  COALESCE(uc.cnt, 0)                                                                                AS unrecorded_sessions
FROM public.patient_packages pp
LEFT JOIN attended_counts   ac  ON pp.id = ac.package_id
LEFT JOIN scheduled_counts  sc  ON pp.id = sc.package_id
LEFT JOIN unrecorded_counts uc  ON pp.id = uc.package_id
LEFT JOIN package_payments  pay ON pp.id = pay.package_id;

REVOKE ALL ON public.patient_packages_with_stats FROM anon;
GRANT SELECT ON public.patient_packages_with_stats TO authenticated, service_role;
