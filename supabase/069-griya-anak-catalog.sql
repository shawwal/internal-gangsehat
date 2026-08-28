-- Migration: seed Griya Anak's real service catalog + store items (Milestone 2/3)
-- Run this in the Supabase SQL editor. Safe to run after 067 + 068.
--
-- Source: the "PENGATURAN" sheet of FT-KLINIK GRIYA ANAK.xlsx (Griya Anak's
-- own price list). Services (non-highlighted rows) go to internal_layanan;
-- the red-highlighted "AGS Store (...)" rows go to griya_products.
--
-- Idempotent: drops the placeholder harga=0 rows seeded by 067, then inserts
-- each catalog/product row only if a same-name row for the branch is absent.

DO $$
DECLARE
  v_branch uuid;
BEGIN
  SELECT id INTO v_branch FROM public.branches WHERE name ILIKE '%Griya Anak%' LIMIT 1;
  IF v_branch IS NULL THEN
    RAISE NOTICE 'Griya Anak branch not found — nothing seeded.';
    RETURN;
  END IF;

  -- ── drop 067's placeholder rows (only if still at harga 0 / unused) ──────
  DELETE FROM public.internal_layanan
  WHERE branch_id = v_branch
    AND harga = 0
    AND nama IN ('Terapi Awal', 'Sesi Terapi', 'Paket P1', 'Paket P2');

  -- ── services → internal_layanan ────────────────────────────────────────
  INSERT INTO public.internal_layanan (branch_id, nama, kategori, jumlah_sesi, harga, is_active)
  SELECT v_branch, s.nama, s.kategori, s.jumlah_sesi, s.harga, true
  FROM (VALUES
    ('AGS Terapi Awal 1',                   'TA KLINIK',    NULL::int, 250000),
    ('AGS Terapi Awal 2',                   'TA KLINIK',    NULL,      350000),
    ('AGS Sesi Terapi',                     'SESI KLINIK',  1,         180000),
    ('AGS Paket Terapi 1',                  'PAKET KLINIK', 5,         400000),
    ('AGS Paket Terapi 2',                  'PAKET KLINIK', 10,        1500000),
    ('AGS Terapi Awal Homevisit',           'TA VISIT',     NULL,      350000),
    ('AGS Terapi Awal Homevisit + Jarak',   'TA VISIT',     NULL,      400000),
    ('AGS Sesi Terapi Homevisit',           'SESI VISIT',   1,         250000),
    ('AGS Sesi Terapi Homevisit + Jarak',   'SESI VISIT',   1,         300000),
    ('AGS Paket Terapi Home Visit',         'PAKET VISIT',  10,        1500000),
    ('AGS Paket Terapi Home Visit + Jarak', 'PAKET VISIT',  10,        1800000),
    ('AGS Konsultasi Psikolog',             'LAINNYA',      1,         350000),
    ('AGS Test IQ / Psikotest',             'LAINNYA',      1,         450000),
    ('AGS Test Kesiapan Sekolah',           'LAINNYA',      1,         350000),
    ('AGS Test Minat Bakat',                'LAINNYA',      1,         450000)
  ) AS s(nama, kategori, jumlah_sesi, harga)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.internal_layanan il
    WHERE il.branch_id = v_branch AND il.nama = s.nama
  );

  -- ── store items → griya_products (stock 0 — restock in /griya-anak/toko) ─
  INSERT INTO public.griya_products (branch_id, name, category, price, stock, is_active)
  SELECT v_branch, p.name, p.category, p.price, 0, true
  FROM (VALUES
    ('Buku',       'BUKU',        30000),
    ('Busy Jar',   'ALAT TERAPI', 40000),
    ('Puzzle',     'ALAT TERAPI', 30000),
    ('Sikat',      'ALAT TERAPI', 60000),
    ('Flash Card', 'BUKU',        60000),
    ('Strappal',   'ALAT TERAPI', 50000),
    ('Sepatu',     'MERCHANDISE', 0)
  ) AS p(name, category, price)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.griya_products gp
    WHERE gp.branch_id = v_branch AND gp.name = p.name
  );
END $$;
