-- Migration: Griya Anak package & price settings (Milestone 2)
-- Run this in the Supabase SQL editor.
--
-- internal_layanan is ALREADY fully per-branch (branch_id NOT NULL). Package
-- price is resolved per-branch by fetchLayananHarga(serviceType, branchId,
-- sessions) — nothing is shared between branches. So this migration only
-- lets the Griya Anak `admin` role edit its own branch's price catalog
-- (today only director / manager / finance can — see 055 + 064), so the new
-- /griya-anak/pengaturan page works for admins. The catalog itself is seeded
-- by 069-griya-anak-catalog.sql.

-- ── 1. admin can manage its own branch's price catalog ────────────────────

CREATE POLICY "internal_layanan: admin own branch"
ON public.internal_layanan FOR ALL
USING (get_my_internal_role() = 'admin' AND branch_id = get_my_branch())
WITH CHECK (get_my_internal_role() = 'admin' AND branch_id = get_my_branch());

-- ── 2. catalog seed ──────────────────────────────────────────────────────
-- The real Griya Anak service catalog + store items are seeded by
-- 069-griya-anak-catalog.sql (from the workbook's "PENGATURAN" sheet).
