-- ============================================================
-- Migration 007: make branch_id nullable in staff_targets
-- ============================================================
-- branch_id was NOT NULL, which causes inserts to fail when
-- the user's profile has no branch assigned (e.g. director).
-- The staff_id → internal_profiles join already captures the
-- branch context, so the constraint is redundant.

ALTER TABLE public.staff_targets
  ALTER COLUMN branch_id DROP NOT NULL;
