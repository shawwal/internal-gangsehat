-- Data fix: Ria Vergina (R8826071407) bought Paket Silver (P1) 3x, but only the
-- first package was ever created — all 12 sessions were linked to it.
-- Creates Silver #2 and #3 and moves sessions 6–10 and 11–12 onto them.
-- Payments are NOT recorded here — admin enters them via the app.
-- Run in the Supabase SQL editor.

BEGIN;

WITH src AS (
  SELECT branch_id FROM public.patient_packages WHERE id = '7b5404d0-76b0-47d9-a4a3-4b9ea9cdd89b'
),
new_pkgs AS (
  INSERT INTO public.patient_packages
    (patient_id, branch_id, package_name, package_type, total_sessions, jenis_paket, mulai_paket,
     category, order_id, purchased_at, status, operational_status, notes)
  SELECT '8dc5138c-ef01-4e60-b9f5-be0aba7cb87f', src.branch_id, 'Paket Silver', 'fixed', 5, 'P1', 'EXT.',
         'PAKET KLINIK',
         format('TRX/%s/%s/%s', 2026, lpad('10', 2, '0'), lpad(public.next_order_seq(2026, 10)::text, 4, '0')),
         v.purchased_at::date, 'active', 'ON',
         'Perbaikan data: pembelian paket ke-' || v.n || ' tidak tercatat saat itu'
  FROM src, (VALUES (2, '2026-09-05'), (3, '2026-09-29')) AS v(n, purchased_at)
  RETURNING id, purchased_at
)
UPDATE public.patient_visits pv
SET package_id = np.id, updated_at = now()
FROM new_pkgs np
WHERE pv.patient_id = '8dc5138c-ef01-4e60-b9f5-be0aba7cb87f'
  AND pv.package_id = '7b5404d0-76b0-47d9-a4a3-4b9ea9cdd89b'
  AND (
    (np.purchased_at = '2026-09-05' AND pv.visit_date IN ('2026-09-05','2026-09-09','2026-09-13','2026-09-17','2026-09-21'))
 OR (np.purchased_at = '2026-09-29' AND pv.visit_date IN ('2026-09-29','2026-10-04'))
  );

-- Expect: 3 packages, 5 / 5 / 2 linked visits
SELECT pp.order_id, pp.purchased_at, pp.total_sessions, COUNT(pv.id) AS linked_visits
FROM public.patient_packages pp
LEFT JOIN public.patient_visits pv ON pv.package_id = pp.id
WHERE pp.patient_id = '8dc5138c-ef01-4e60-b9f5-be0aba7cb87f'
GROUP BY pp.id ORDER BY pp.purchased_at;

COMMIT;
