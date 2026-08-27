-- Migration: Griya Anak package & price settings (Milestone 2)
-- Run this in the Supabase SQL editor.
--
-- internal_layanan is ALREADY fully per-branch (branch_id NOT NULL). Package
-- price is resolved per-branch by fetchLayananHarga(serviceType, branchId,
-- sessions) — nothing is shared between branches. So this migration only:
--   1. lets the Griya Anak `admin` role edit its own branch's price catalog
--      (today only director / manager / finance can — see 055 + 064), so the
--      new /griya-anak/pengaturan page works for admins.
--   2. seeds Griya Anak's catalog rows so the buy-package flow has entries to
--      resolve. Prices are seeded as 0 — the Griya manager/admin MUST set the
--      real amounts on /griya-anak/pengaturan (or /finance/accounting →
--      Pengaturan) before selling packages.

-- ── 1. admin can manage its own branch's price catalog ────────────────────

CREATE POLICY "internal_layanan: admin own branch"
ON public.internal_layanan FOR ALL
USING (get_my_internal_role() = 'admin' AND branch_id = get_my_branch())
WITH CHECK (get_my_internal_role() = 'admin' AND branch_id = get_my_branch());

-- ── 2. seed Griya Anak's catalog (harga = 0, set real prices in the app) ──

INSERT INTO public.internal_layanan (branch_id, nama, kategori, jumlah_sesi, harga, is_active)
SELECT b.id, v.nama, v.kategori, v.jumlah_sesi, 0, true
FROM public.branches b
CROSS JOIN (VALUES
  ('Terapi Awal',   'TA KLINIK',    NULL::int),
  ('Sesi Terapi',   'SESI KLINIK',  1),
  ('Paket P1',      'PAKET KLINIK', 5),
  ('Paket P2',      'PAKET KLINIK', 10)
) AS v(nama, kategori, jumlah_sesi)
WHERE b.name ILIKE '%Griya Anak%'
  AND NOT EXISTS (
    SELECT 1 FROM public.internal_layanan il
    WHERE il.branch_id = b.id AND il.nama = v.nama
  );
