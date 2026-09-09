-- Migration: make schedule_slots branch-specific
--
-- schedule_slots was a single global list of Pagi/Sore time options shared by
-- every branch. Each branch now keeps its own list. Existing global slots are
-- fanned out to every active branch as a starting point.
--
-- Run this in the Supabase SQL editor.

-- 1. Add branch_id (nullable for the backfill step)
ALTER TABLE public.schedule_slots
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE;

-- 2. Drop the old global unique constraint so the fan-out insert can duplicate
--    (shift, slot_time) rows across branches
ALTER TABLE public.schedule_slots
  DROP CONSTRAINT IF EXISTS schedule_slots_shift_slot_time_key;

-- 3. Backfill: copy every existing global slot to every active branch
INSERT INTO public.schedule_slots (branch_id, shift, slot_time, is_active)
SELECT b.id, s.shift, s.slot_time, s.is_active
FROM public.schedule_slots s
CROSS JOIN public.branches b
WHERE s.branch_id IS NULL
  AND b.is_active;

-- 4. Remove the now-replaced global rows
DELETE FROM public.schedule_slots WHERE branch_id IS NULL;

-- 5. Enforce branch_id
ALTER TABLE public.schedule_slots ALTER COLUMN branch_id SET NOT NULL;

-- 6. New per-branch unique constraint + lookup index
ALTER TABLE public.schedule_slots
  ADD CONSTRAINT schedule_slots_branch_shift_time_key UNIQUE (branch_id, shift, slot_time);

CREATE INDEX IF NOT EXISTS idx_schedule_slots_branch ON public.schedule_slots (branch_id);

-- 7. RLS: director manages all branches; everyone else reads their own branch only
DROP POLICY IF EXISTS "schedule_slots_select_all" ON public.schedule_slots;
DROP POLICY IF EXISTS "schedule_slots_director_manage" ON public.schedule_slots;

CREATE POLICY "schedule_slots_select"
ON public.schedule_slots FOR SELECT
USING (
  get_my_internal_role() = 'director'
  OR branch_id = get_my_branch()
);

CREATE POLICY "schedule_slots_director_manage"
ON public.schedule_slots FOR ALL
USING (get_my_internal_role() = 'director')
WITH CHECK (get_my_internal_role() = 'director');
