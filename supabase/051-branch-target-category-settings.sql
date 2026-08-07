-- Migration: per-branch target category on/off switch.
-- A row present here means that category is DISABLED for that branch
-- (opt-out model — absence of a row = category enabled, the previous
-- implicit behavior). Lets director (any branch) and manager (own branch)
-- turn off categories like Kunjungan or Visit that a branch doesn't track,
-- hiding them from the branch target form and the target-progress page.

CREATE TABLE IF NOT EXISTS public.branch_target_category_settings (
  branch_id   uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  category    text NOT NULL CHECK (category IN ('ta', 'paket_klinik', 'kunjungan', 'paket_visit', 'sesi')),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES public.internal_profiles(id),
  PRIMARY KEY (branch_id, category)
);

ALTER TABLE public.branch_target_category_settings ENABLE ROW LEVEL SECURITY;

-- Any logged-in internal user can read (needed on target-progress + my-targets
-- forms across roles); only director (any branch) or manager (own branch) can write.
CREATE POLICY "branch_target_category_settings_select_all"
ON public.branch_target_category_settings FOR SELECT
USING (get_my_internal_role() IS NOT NULL);

CREATE POLICY "branch_target_category_settings_director_manage"
ON public.branch_target_category_settings FOR ALL
USING (get_my_internal_role() = 'director')
WITH CHECK (get_my_internal_role() = 'director');

CREATE POLICY "branch_target_category_settings_manager_manage_own"
ON public.branch_target_category_settings FOR ALL
USING (get_my_internal_role() = 'manager' AND branch_id = get_my_branch())
WITH CHECK (get_my_internal_role() = 'manager' AND branch_id = get_my_branch());
