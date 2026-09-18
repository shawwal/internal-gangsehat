-- Fix: patient_packages_with_stats gates used_sessions on a confirmed
-- transaction existing in THIS app — but ~872 patient_packages rows were
-- imported from the old website (see supabase/_migration_extract/) and were
-- already paid for before this app tracked transactions at all. Every one of
-- those legacy rows has order_id IS NULL (generateOrderId() in
-- lib/internal/orderId.ts always sets a real order_id for any package
-- created in-app, or throws), so order_id IS NULL is a reliable signal that
-- a package predates the app and should never need an in-app payment record.
--
-- This keeps 059/074's intent (a freshly-created, genuinely unpaid package
-- shows 0 used) but exempts legacy/migrated packages from the gate, and
-- exposes the pass/fail result as payment_ok so the app can also use it for
-- UI warnings (unpaid-package badges) instead of just the session count.
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
  WHERE pp.order_id IS NULL
     OR EXISTS (
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

GRANT SELECT ON public.patient_packages_with_stats TO anon, authenticated, service_role;
