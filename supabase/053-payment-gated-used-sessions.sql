-- Kehadiran ≠ Pembayaran: a session only counts as "used" toward a package's
-- total_sessions when it has a confirmed payment behind it, not merely when
-- the patient was marked present. Attendance alone still gates the visit
-- (explicit no-shows are excluded either way) — this adds the payment gate
-- on top, per the "Sistem Order · Kehadiran · Target" spec.
-- Run this in your Supabase SQL editor.

DROP VIEW IF EXISTS public.patient_packages_with_stats;
CREATE VIEW public.patient_packages_with_stats AS
SELECT
  pp.*,
  pp.legacy_used_sessions + COALESCE(vc.used_sessions, 0)                       AS used_sessions,
  pp.total_sessions - (pp.legacy_used_sessions + COALESCE(vc.used_sessions, 0)) AS remaining_sessions
FROM public.patient_packages pp
LEFT JOIN (
  SELECT v.package_id, COUNT(*) AS used_sessions
  FROM public.patient_visits v
  WHERE v.status != 'cancelled'
    AND v.package_id IS NOT NULL
    AND (v.kehadiran IS NULL OR v.kehadiran != 'TIDAK HADIR')
    AND EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.visit_id = v.id AND t.status = 'confirmed'
    )
  GROUP BY v.package_id
) vc ON pp.id = vc.package_id;
