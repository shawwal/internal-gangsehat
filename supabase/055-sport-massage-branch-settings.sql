-- Sport Massage: per-branch on/off toggle, mirroring the proven
-- branch_target_category_settings pattern (051-branch-target-category-settings.sql).
-- A dedicated single-purpose table is used instead of a column on `branches`
-- so the manager-scoped write policy can't incidentally let a manager patch
-- other branch fields (name/address/phone) — RLS is row-level, not
-- column-level, so a manager UPDATE policy on `branches` itself would have
-- that gap.

CREATE TABLE public.branch_sport_massage_settings (
  branch_id  uuid PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
  enabled    boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.internal_profiles(id)
);

ALTER TABLE public.branch_sport_massage_settings ENABLE ROW LEVEL SECURITY;

-- Any logged-in internal user can read (needed for nav visibility checks
-- and the jadwal-sport-massage page's own branch-flag gate, across roles).
CREATE POLICY "branch_sport_massage_settings_select_all"
ON public.branch_sport_massage_settings FOR SELECT
USING (get_my_internal_role() IS NOT NULL);

CREATE POLICY "branch_sport_massage_settings_director_manage"
ON public.branch_sport_massage_settings FOR ALL
USING (get_my_internal_role() = 'director')
WITH CHECK (get_my_internal_role() = 'director');

CREATE POLICY "branch_sport_massage_settings_manager_manage_own"
ON public.branch_sport_massage_settings FOR ALL
USING (get_my_internal_role() = 'manager' AND branch_id = get_my_branch())
WITH CHECK (get_my_internal_role() = 'manager' AND branch_id = get_my_branch());

-- Pre-existing bug fix (found while implementing sport massage pricing):
-- "internal_layanan: admin write" checked public.profiles/public.user_role
-- (the separate consumer-booking-app schema), not internal_profiles/
-- internal_user_role — so no real director/manager could pass this write
-- check via the RLS-enforced app client. Sport massage pricing (via
-- internal_layanan) depends on this actually working, so it's fixed here.
DROP POLICY IF EXISTS "internal_layanan: admin write" ON public.internal_layanan;

CREATE POLICY "internal_layanan: director all"
ON public.internal_layanan FOR ALL
USING (get_my_internal_role() = 'director')
WITH CHECK (get_my_internal_role() = 'director');

CREATE POLICY "internal_layanan: manager own branch"
ON public.internal_layanan FOR ALL
USING (get_my_internal_role() = 'manager' AND branch_id = get_my_branch())
WITH CHECK (get_my_internal_role() = 'manager' AND branch_id = get_my_branch());
