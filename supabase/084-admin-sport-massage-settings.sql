-- Migration: let admin manage its own branch's Sport Massage settings.
--
-- /branch-settings (Pengaturan Cabang) holds the per-branch Sport Massage
-- on/off toggle and the Sport Massage price. Until now only director and
-- manager could reach it. admin is the branch-scoped operational role and
-- already runs /jadwal-sport-massage and /jadwal-sport-massage/performa, so
-- it now also gets the toggle + price for its own branch.
--
-- The price already works for admin: it is stored in internal_layanan, and
-- "internal_layanan: admin own branch" (067-griya-anak-layanan-access.sql)
-- already lets admin write its own branch's rows. Only the toggle table
-- needs a policy, mirroring the manager one from
-- 055-sport-massage-branch-settings.sql.
--
-- Run this in the Supabase SQL editor.

CREATE POLICY "branch_sport_massage_settings_admin_manage_own"
ON public.branch_sport_massage_settings FOR ALL
USING (get_my_internal_role() = 'admin' AND branch_id = get_my_branch())
WITH CHECK (get_my_internal_role() = 'admin' AND branch_id = get_my_branch());
