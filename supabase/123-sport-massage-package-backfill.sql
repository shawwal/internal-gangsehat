-- 123 — Sport Massage package backfill
-- Before PaymentDialog created packages for PAKET SPORT MASSAGE tariffs (≈3–24
-- Okt 2026), a package sale was saved as a plain 'SPORT MASSAGE' income on a
-- visit whose layanan_id is a PAKET SPORT MASSAGE Layanan — no patient_packages
-- row, so the package never appeared on /patients/[id]/packages.
--
-- 1. Combo Layanan had no jumlah_sesi (packages from them got 1 session).
--    Counts from their deskripsi: Combo 1 = 2 Full Body + 1 Segmental = 3,
--    Combo 2 = 1 Full Body + 3 Segmental = 4.
-- 2. Fix the packages already created from them with the fallback of 1.
-- 3. One package per paid legacy sale: the transaction moves to category
--    PAKET SPORT MASSAGE and joins the package's order; the paid visit and the
--    patient's later unpaid visits on the same Layanan are linked to it, up to
--    total_sessions. Sport Massage payroll is unchanged — package visits
--    resolve to the same Layanan via patient_packages.layanan_id.

BEGIN;

-- ── 1. Combo session counts ─────────────────────────────────────────────────
UPDATE public.internal_layanan SET jumlah_sesi = 3
WHERE kategori = 'PAKET SPORT MASSAGE' AND nama = 'Paket Combo 1 Sports Massage' AND jumlah_sesi IS NULL;
UPDATE public.internal_layanan SET jumlah_sesi = 4
WHERE kategori = 'PAKET SPORT MASSAGE' AND nama = 'Paket Combo 2 Sports Massage' AND jumlah_sesi IS NULL;

-- ── 2. Packages created with the 1-session fallback ─────────────────────────
UPDATE public.patient_packages pp
SET total_sessions = l.jumlah_sesi, updated_at = now()
FROM public.internal_layanan l
WHERE pp.layanan_id = l.id
  AND l.kategori = 'PAKET SPORT MASSAGE'
  AND l.nama IN ('Paket Combo 1 Sports Massage', 'Paket Combo 2 Sports Massage')
  AND pp.total_sessions = 1
  AND l.jumlah_sesi > 1;

-- ── 3. Backfill legacy sales ────────────────────────────────────────────────
DO $$
DECLARE
  r        record;
  v_pkg    uuid;
  v_order  text;
  v_seq    int;
BEGIN
  FOR r IN
    SELECT t.id AS tx_id, t.order_id, t.transaction_date,
           v.id AS visit_id, v.patient_id, v.branch_id, v.visit_date, v.layanan_id,
           l.nama, coalesce(l.jumlah_sesi, 1) AS total_sessions
    FROM public.transactions t
    JOIN public.patient_visits v   ON v.id = t.visit_id
    JOIN public.internal_layanan l ON l.id = v.layanan_id
    WHERE t.type = 'income'
      AND t.category = 'SPORT MASSAGE'
      AND t.status <> 'rejected'
      AND v.package_id IS NULL
      AND l.kategori = 'PAKET SPORT MASSAGE'
    ORDER BY t.transaction_date, t.created_at
  LOOP
    v_order := r.order_id;
    IF v_order IS NULL THEN
      v_seq := public.next_order_seq(
        extract(year FROM r.transaction_date)::int, extract(month FROM r.transaction_date)::int);
      v_order := format('TRX/%s/%s/%s',
        extract(year FROM r.transaction_date)::int,
        lpad(extract(month FROM r.transaction_date)::int::text, 2, '0'),
        lpad(v_seq::text, 4, '0'));
      UPDATE public.transactions SET order_id = v_order WHERE id = r.tx_id;
    END IF;

    INSERT INTO public.patient_packages (
      patient_id, branch_id, package_name, layanan_id, package_type, total_sessions,
      jenis_paket, mulai_paket, category, order_id, legacy_used_sessions, purchased_at, updated_at)
    VALUES (
      r.patient_id, r.branch_id, r.nama, r.layanan_id, 'fixed', r.total_sessions,
      CASE r.total_sessions WHEN 5 THEN 'P1' WHEN 10 THEN 'P2' END, 'NEW',
      'PAKET SPORT MASSAGE', v_order, 0, r.transaction_date, now())
    RETURNING id INTO v_pkg;

    UPDATE public.transactions
    SET category = 'PAKET SPORT MASSAGE', updated_at = now()
    WHERE id = r.tx_id;

    -- The paid visit, then later unpaid visits of the same Layanan.
    UPDATE public.patient_visits
    SET package_id = v_pkg, updated_at = now()
    WHERE id IN (
      SELECT pv.id
      FROM public.patient_visits pv
      WHERE pv.patient_id = r.patient_id
        AND pv.layanan_id = r.layanan_id
        AND pv.package_id IS NULL
        AND pv.status <> 'cancelled'
        AND (pv.id = r.visit_id OR (
          pv.visit_date >= r.visit_date
          AND NOT EXISTS (
            SELECT 1 FROM public.transactions t2
            WHERE t2.visit_id = pv.id AND t2.status <> 'rejected')))
      ORDER BY (pv.id = r.visit_id) DESC, pv.visit_date, pv.created_at
      LIMIT r.total_sessions
    );
  END LOOP;
END $$;

COMMIT;

-- ── Report ──────────────────────────────────────────────────────────────────
-- Backfilled packages:
SELECT pp.id, pa.no_rm, pp.package_name, pp.total_sessions, pp.order_id, pp.purchased_at,
       (SELECT count(*) FROM public.patient_visits pv WHERE pv.package_id = pp.id) AS linked_visits
FROM public.patient_packages pp
JOIN public.patients pa ON pa.id = pp.patient_id
WHERE pp.category = 'PAKET SPORT MASSAGE'
ORDER BY pp.purchased_at;

-- Visits on a package Layanan still without a package (no payment found) —
-- follow up by hand:
SELECT pa.no_rm, v.visit_date, v.status, l.nama
FROM public.patient_visits v
JOIN public.internal_layanan l ON l.id = v.layanan_id
JOIN public.patients pa ON pa.id = v.patient_id
WHERE l.kategori = 'PAKET SPORT MASSAGE' AND v.package_id IS NULL
ORDER BY v.visit_date;
