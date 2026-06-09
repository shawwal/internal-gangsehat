-- Migration 019: Fix schedules unique constraint
--
-- The original constraint was UNIQUE(staff_id, hari, shift), which meant a
-- single staff member could theoretically have both a PAGI and SORE row for
-- the same day. In practice, the UI (MonthlyScheduleDialog + ScheduleDialog)
-- only writes one row per staff per day and uses:
--   upsert(rows, { onConflict: 'staff_id,hari' })
-- This upsert fails because PostgreSQL requires an exact matching unique index
-- for the ON CONFLICT clause.
--
-- Fix: replace the 3-column constraint with a 2-column one (staff_id, hari).
-- One staff = one schedule entry per day. The shift field on that row can be
-- PAGI or SORE as needed.
--
-- If duplicate (staff_id, hari) rows exist (shouldn't happen in practice),
-- the migration removes all but the most recently created one before adding
-- the new constraint.

-- Step 1: Remove duplicate (staff_id, hari) rows, keeping the newest id
DELETE FROM public.schedules
WHERE id NOT IN (
  SELECT DISTINCT ON (staff_id, hari) id
  FROM public.schedules
  ORDER BY staff_id, hari, created_at DESC NULLS LAST
);

-- Step 2: Drop the old 3-column unique constraint
ALTER TABLE public.schedules
  DROP CONSTRAINT IF EXISTS schedules_staff_id_hari_shift_key;

-- Step 3: Add the correct 2-column unique constraint
ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_staff_id_hari_key UNIQUE (staff_id, hari);
