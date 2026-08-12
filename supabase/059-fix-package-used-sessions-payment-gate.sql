-- Fix: patient_packages_with_stats.used_sessions undercounts paid packages.
--
-- 053-payment-gated-used-sessions.sql gated used_sessions on a PER-VISIT
-- confirmed transaction (`t.visit_id = v.id`). But payment for a package is
-- recorded once — either against the package's own order_id, or against the
-- single purchasing visit (see fetchPatientPackagesWithPayment in
-- app/actions/packages.ts) — not against every session visit individually.
-- So a fully-paid, fully-attended 5-session package showed only 1/5 used:
-- the one visit that happened to carry the transaction row.
--
-- This keeps 053's intent (unpaid package => 0 used) but gates at the
-- PACKAGE level using the same dual-path payment check the app already uses
-- (order_id match OR visit_id -> package_id match), instead of per-visit.
-- Run this in your Supabase SQL editor.

DROP VIEW IF EXISTS public.patient_packages_with_stats;
CREATE VIEW public.patient_packages_with_stats AS
WITH visit_counts AS (
  SELECT package_id, COUNT(*) AS cnt
  FROM public.patient_visits
  WHERE status != 'cancelled'
    AND package_id IS NOT NULL
    AND (kehadiran IS NULL OR kehadiran != 'TIDAK HADIR')
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
  pp.legacy_used_sessions + COALESCE(CASE WHEN pay.package_id IS NOT NULL THEN vc.cnt ELSE 0 END, 0)                       AS used_sessions,
  pp.total_sessions - (pp.legacy_used_sessions + COALESCE(CASE WHEN pay.package_id IS NOT NULL THEN vc.cnt ELSE 0 END, 0)) AS remaining_sessions
FROM public.patient_packages pp
LEFT JOIN visit_counts     vc  ON pp.id = vc.package_id
LEFT JOIN package_payments pay ON pp.id = pay.package_id;
