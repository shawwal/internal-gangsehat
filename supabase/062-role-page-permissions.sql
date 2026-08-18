-- Run this in the Supabase SQL editor.
--
-- Director-managed page access control. This table stores only *overrides*
-- of the default role→page access baked into config/navigation.ts (NavItem.
-- roles). No override row for a (page_key, role) pair means "use the coded
-- default" — so this table starts empty and changes nothing until a director
-- explicitly toggles something in /director/access-control. New pages added
-- later automatically default to their coded roles until overridden.
--
-- `director` is never looked up here — every access check short-circuits to
-- always-allow for director in application code, so this table can never
-- lock the director out.

CREATE TABLE IF NOT EXISTS public.role_page_permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key    text NOT NULL,
  role        public.internal_user_role NOT NULL,
  allowed     boolean NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES public.internal_profiles(id) ON DELETE SET NULL,
  UNIQUE (page_key, role)
);

ALTER TABLE public.role_page_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rpp: director all" ON public.role_page_permissions
  USING (public.get_my_internal_role() = 'director')
  WITH CHECK (public.get_my_internal_role() = 'director');

-- Every authenticated user needs to read this table so proxy.ts and the
-- dashboard layout can resolve their own effective page access. Not
-- sensitive data — it only says which page keys exist per role, no PII.
CREATE POLICY "rpp: staff read" ON public.role_page_permissions FOR SELECT
  TO authenticated USING (true);
