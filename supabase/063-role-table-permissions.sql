-- Run this in the Supabase SQL editor.
--
-- Pilot: makes RLS on `transactions` and `attendance` dynamic, driven by the
-- director's page-access toggles at /director/access-control instead of
-- hardcoded per-role policies. Unlike role_page_permissions (an
-- overrides-only table resolved in application code), Postgres RLS can't
-- consult a TypeScript default — so this table is a full, explicitly seeded
-- mirror of the access these roles have *today*, not a diff. Seeding it
-- with today's values first means running this migration changes nothing
-- until a director actually flips a toggle afterward.
--
-- `director` is never looked up here — every policy below keeps its
-- existing unconditional director-all policy untouched, so a bug or missing
-- row in role_table_permissions can never lock the director out.
--
-- Scope is intentionally narrow (2 tables) as a pilot. Extending this to
-- more tables means: (1) add rows here mirroring that table's current
-- policies, (2) drop the old per-role policies on it, (3) add one
-- "<table>: dynamic role access" policy using has_table_access(), and
-- (4) map the relevant page_key(s) to the table name in
-- lib/pageTableMap.ts.

CREATE TABLE IF NOT EXISTS public.role_table_permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  text NOT NULL,
  role        public.internal_user_role NOT NULL,
  allowed     boolean NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES public.internal_profiles(id) ON DELETE SET NULL,
  UNIQUE (table_name, role)
);

ALTER TABLE public.role_table_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rtp: director all" ON public.role_table_permissions
  USING (public.get_my_internal_role() = 'director')
  WITH CHECK (public.get_my_internal_role() = 'director');

CREATE POLICY "rtp: staff read" ON public.role_table_permissions FOR SELECT
  TO authenticated USING (true);

-- Seed with today's effective access so this migration is a no-op until a
-- director changes something. (branch scoping stays hardcoded in each
-- table's policy below — this only gates the role, not the branch.)
INSERT INTO public.role_table_permissions (table_name, role, allowed) VALUES
  ('transactions', 'finance',  true),
  ('transactions', 'manager',  true),
  ('transactions', 'admin',    true),
  ('attendance',   'hr',       true),
  ('attendance',   'manager',  true)
ON CONFLICT (table_name, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_table_access(tbl text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT COALESCE(
    (SELECT allowed FROM public.role_table_permissions
     WHERE table_name = tbl AND role = (public.get_my_internal_role())::public.internal_user_role),
    false
  );
$function$;

-- ── transactions ────────────────────────────────────────────────────────
-- Replaces the duplicated per-role policies (both the unquoted
-- transactions_* names and the quoted "tx: *" names — leftover duplication
-- from an earlier migration pass) with one dynamic policy. Director keeps
-- its own unconditional policy, untouched.
DROP POLICY IF EXISTS transactions_admin_own_branch ON public.transactions;
DROP POLICY IF EXISTS transactions_finance_own_branch ON public.transactions;
DROP POLICY IF EXISTS transactions_manager_own_branch ON public.transactions;
DROP POLICY IF EXISTS transactions_director_all ON public.transactions;
DROP POLICY IF EXISTS "tx: finance branch" ON public.transactions;
DROP POLICY IF EXISTS "tx: manager branch" ON public.transactions;
DROP POLICY IF EXISTS "tx: director all" ON public.transactions;

CREATE POLICY "tx: director all" ON public.transactions
  USING (public.get_my_internal_role() = 'director')
  WITH CHECK (public.get_my_internal_role() = 'director');

CREATE POLICY "tx: dynamic role access" ON public.transactions
  USING (public.has_table_access('transactions') AND branch_id = public.get_my_branch())
  WITH CHECK (public.has_table_access('transactions') AND branch_id = public.get_my_branch());

-- ── attendance ───────────────────────────────────────────────────────────
-- "att: own read" (self-visibility for every staff member) is left
-- untouched — that's a baseline right, not something a page-access toggle
-- should be able to take away.
DROP POLICY IF EXISTS "att: hr branch" ON public.attendance;
DROP POLICY IF EXISTS "att: manager branch" ON public.attendance;
DROP POLICY IF EXISTS "att: director all" ON public.attendance;

CREATE POLICY "att: director all" ON public.attendance
  USING (public.get_my_internal_role() = 'director')
  WITH CHECK (public.get_my_internal_role() = 'director');

CREATE POLICY "att: dynamic role access" ON public.attendance
  USING (public.has_table_access('attendance') AND branch_id = public.get_my_branch())
  WITH CHECK (public.has_table_access('attendance') AND branch_id = public.get_my_branch());
