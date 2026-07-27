-- Adds a week_group tag to `schedules` so a staff member's pattern can differ
-- between the first and second half of a biweekly cycle (Minggu 1 / Minggu 2).
-- 'SEMUA' (default) preserves current behavior: applies every week.

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS week_group character varying NOT NULL DEFAULT 'SEMUA'
  CHECK (week_group IN ('SEMUA', 'MINGGU_1', 'MINGGU_2'));

-- Replace whatever unique constraint/index currently backs
-- upsert(..., { onConflict: 'staff_id,hari' }) with one that also covers
-- week_group, so a MINGGU_1 row and a MINGGU_2 row can coexist for the same
-- staff_id + hari.
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.schedules'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.schedules DROP CONSTRAINT %I', rec.conname);
  END LOOP;

  FOR rec IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'schedules'
      AND indexname <> 'schedules_pkey'
      AND indexname <> 'schedules_staff_hari_week_key'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', rec.indexname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS schedules_staff_hari_week_key
  ON public.schedules (staff_id, hari, week_group);
