-- Package progress no longer waits for a payment.
--
-- Since 053/059/080 used_sessions was payment-gated: a package with an
-- order_id but no non-rejected transaction showed 0 used / full remaining
-- even after the patient attended sessions. Staff need the real remaining
-- count for every patient regardless of payment (e.g. Singkawang packages
-- sold before payments were recorded in the app).
--
-- Rules now:
--   used       = legacy_used_sessions + attended visits (not cancelled, HADIR)
--   remaining  = total_sessions - used
--   payment_ok = unchanged — still drives the "belum bayar" badges
--                (VisitCard, PackageCard), it just no longer hides progress.
-- scheduled/unrecorded counts, column order and grants are unchanged from 098,
-- so CREATE OR REPLACE keeps dependents intact.
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
  pay.package_id IS NOT NULL                                              AS payment_ok,
  pp.legacy_used_sessions + COALESCE(ac.cnt, 0)                           AS used_sessions,
  pp.total_sessions - (pp.legacy_used_sessions + COALESCE(ac.cnt, 0))     AS remaining_sessions,
  COALESCE(sc.cnt, 0)                                                     AS scheduled_sessions,
  COALESCE(uc.cnt, 0)                                                     AS unrecorded_sessions
FROM public.patient_packages pp
LEFT JOIN attended_counts   ac  ON pp.id = ac.package_id
LEFT JOIN scheduled_counts  sc  ON pp.id = sc.package_id
LEFT JOIN unrecorded_counts uc  ON pp.id = uc.package_id
LEFT JOIN package_payments  pay ON pp.id = pay.package_id;

REVOKE ALL ON public.patient_packages_with_stats FROM anon;
GRANT SELECT ON public.patient_packages_with_stats TO authenticated, service_role;
