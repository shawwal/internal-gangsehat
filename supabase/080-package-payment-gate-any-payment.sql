-- Fix: a package with a DP / cicilan payment still showed "Belum ada pembayaran
-- tercatat" and 0 used sessions.
--
-- The payment gate in patient_packages_with_stats (059/074/079) required a
-- transaction with status = 'confirmed'. But installment payments are stored
-- as 'pending' until finance confirms them (addPaymentToOrder always inserts
-- 'pending'; createTransactionForVisit does so unless LUNAS), so any package
-- paid by DP/cicilan was blocked even though money was received.
--
-- New rule: a package is usable once ANY non-rejected payment (amount > 0) is
-- recorded against it (by order_id or via a linked visit), regardless of
-- amount or confirmation state. Legacy packages (order_id IS NULL) stay exempt.
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

GRANT SELECT ON public.patient_packages_with_stats TO anon, authenticated, service_role;
