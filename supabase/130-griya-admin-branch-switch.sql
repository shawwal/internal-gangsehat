-- 130 — Griya branches: admin may open any Griya-enabled branch on /griya-anak
-- Nafaya Centre runs the same Griya Anak workspace (branch_griya_settings.enabled).
-- The admin of a Griya-enabled branch can switch the /griya-anak pages between
-- every Griya-enabled branch to see (and run) what's going on there.
--
-- How: those pages send the picked branch as the `x-griya-branch` request
-- header (cookie scoped to /griya-anak — lib/griyaBranch.ts). get_my_branch()
-- returns it instead of the admin's own branch when
--   • the caller is an admin, and their own branch is Griya-enabled, and
--   • the requested branch is Griya-enabled and active.
-- Every policy already scopes by get_my_branch(), so for that request the admin
-- acts on the picked branch exactly as on their own; without the header (every
-- non-Griya page) nothing changes. Other roles ignore the header — director is
-- cross-branch already.
--
-- Run this in your Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.get_my_branch()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_home   uuid;
  v_role   text;
  v_req    text;
  v_target uuid;
BEGIN
  SELECT branch_id, role::text INTO v_home, v_role
  FROM internal_profiles WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'admin' OR v_home IS NULL THEN
    RETURN v_home;
  END IF;

  v_req := nullif(current_setting('request.headers', true), '')::json ->> 'x-griya-branch';
  IF v_req IS NULL
     OR v_req !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN v_home;
  END IF;
  v_target := v_req::uuid;
  IF v_target = v_home THEN
    RETURN v_home;
  END IF;

  IF EXISTS (SELECT 1 FROM branch_griya_settings WHERE branch_id = v_home AND enabled)
     AND EXISTS (
       SELECT 1 FROM branch_griya_settings g JOIN branches b ON b.id = g.branch_id
       WHERE g.branch_id = v_target AND g.enabled AND b.is_active
     ) THEN
    RETURN v_target;
  END IF;

  RETURN v_home;
END;
$$;

-- ── Enable Nafaya Centre ────────────────────────────────────────────────────
-- Same as toggling "Griya Anak" on in Pengaturan Cabang. The branch must also be
-- active (Direktur → Cabang) to appear in the branch picker.
INSERT INTO public.branch_griya_settings (branch_id, enabled)
SELECT id, true FROM public.branches WHERE name ILIKE '%Nafaya%'
ON CONFLICT (branch_id) DO UPDATE SET enabled = true, updated_at = now();
