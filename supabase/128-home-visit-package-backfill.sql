-- 128 — Home visit package backfill
-- A PAKET VISIT payment entered from the generic forms (akuntansi / finance /
-- closing) with no visit and no package saved only the transaction — no
-- patient_packages row, so the package never showed on /patients/[id]/packages
-- or /home-visit (e.g. AZMAN, 16 Okt 2026). createTransactionManual now links
-- or creates the package (resolvePackageForManualPayment); this fixes the
-- October 2026 sales already saved that way.
--
-- Only the five Pontianak sales below: paid, no visit, and the patient has no
-- package and no visit since the payment. Older unlinked sales (Feb–Jun 2026)
-- are left alone — their sessions may have been logged without a package.
--
-- One package per sale, from the Tarif Layanan entry with the same kategori
-- and harga; the transaction joins the package's new order.

BEGIN;

DO $$
DECLARE
  r        record;
  v_order  text;
  v_seq    int;
BEGIN
  FOR r IN
    SELECT t.id AS tx_id, t.patient_id, t.branch_id, t.transaction_date, t.recorded_by,
           l.id AS layanan_id, l.nama, coalesce(l.jumlah_sesi, 1) AS total_sessions
    FROM public.transactions t
    JOIN LATERAL (
      SELECT il.id, il.nama, il.jumlah_sesi
      FROM public.internal_layanan il
      WHERE il.branch_id = t.branch_id
        AND il.kategori = 'PAKET VISIT'
        AND il.harga = t.harga
      ORDER BY il.is_active DESC, il.created_at
      LIMIT 1
    ) l ON true
    WHERE t.id IN (
      'f3e88c83-2b94-4a9b-8360-4bf4d79b4151',  -- AZMAN         16 Okt, 1.800.000
      '22ab1ab3-496e-4591-b3c1-ceb451042bd9',  -- THE IE LENG   05 Okt, 1.800.000
      'daf78e28-5563-402b-b537-0749ced3474b',  -- FERA HENDRA   07 Okt, 2.300.000
      '082a079e-e562-4c1c-b04b-8ce067f726bb',  -- ENDANG MULYANI 14 Okt, 1.800.000
      '531ed84f-26a7-4674-84e0-c091eba32d18'   -- SUMIATI       27 Okt, 2.300.000
    )
      AND t.category = 'PAKET VISIT'
      AND t.status <> 'rejected'
      AND t.order_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.patient_packages pp
        WHERE pp.patient_id = t.patient_id AND pp.category = 'PAKET VISIT')
    ORDER BY t.transaction_date, t.created_at
  LOOP
    v_seq := public.next_order_seq(
      extract(year FROM r.transaction_date)::int, extract(month FROM r.transaction_date)::int);
    v_order := format('TRX/%s/%s/%s',
      extract(year FROM r.transaction_date)::int,
      lpad(extract(month FROM r.transaction_date)::int::text, 2, '0'),
      lpad(v_seq::text, 4, '0'));

    INSERT INTO public.patient_packages (
      patient_id, branch_id, package_name, layanan_id, package_type, total_sessions,
      jenis_paket, mulai_paket, category, order_id, legacy_used_sessions, purchased_at,
      created_by, updated_at)
    VALUES (
      r.patient_id, r.branch_id, r.nama, r.layanan_id, 'fixed', r.total_sessions,
      CASE r.total_sessions WHEN 5 THEN 'P1' WHEN 10 THEN 'P2' END, 'NEW',
      'PAKET VISIT', v_order, 0, r.transaction_date, r.recorded_by, now());

    UPDATE public.transactions
    SET order_id = v_order, updated_at = now()
    WHERE id = r.tx_id;
  END LOOP;
END $$;

COMMIT;

-- ── Report ──────────────────────────────────────────────────────────────────
SELECT pa.name_normalized, pa.no_rm, pp.package_name, pp.total_sessions, pp.order_id, pp.purchased_at
FROM public.patient_packages pp
JOIN public.patients pa ON pa.id = pp.patient_id
JOIN public.transactions t ON t.order_id = pp.order_id
WHERE t.id IN (
  'f3e88c83-2b94-4a9b-8360-4bf4d79b4151',
  '22ab1ab3-496e-4591-b3c1-ceb451042bd9',
  'daf78e28-5563-402b-b537-0749ced3474b',
  '082a079e-e562-4c1c-b04b-8ce067f726bb',
  '531ed84f-26a7-4674-84e0-c091eba32d18'
)
ORDER BY pp.purchased_at;
