-- Activity log for director/manager review. No DB triggers — rows are
-- inserted manually via lib/activityLog.ts's logActivity() at each tracked
-- mutation call site. Append-only: no UPDATE/DELETE policy.

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES public.internal_profiles(id) ON DELETE SET NULL,
  actor_email    text,
  actor_name     text,
  action         text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  resource_type  text NOT NULL,
  resource_id    text,
  resource_label text,
  branch_id      uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  changed_fields text[],
  old_values     jsonb,
  new_values     jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx     ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_branch_created_idx ON public.activity_logs (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_resource_type_idx  ON public.activity_logs (resource_type);
CREATE INDEX IF NOT EXISTS activity_logs_action_idx         ON public.activity_logs (action);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "al: director all select"
ON public.activity_logs FOR SELECT
USING (public.get_my_internal_role() = 'director');

CREATE POLICY "al: manager branch select"
ON public.activity_logs FOR SELECT
USING (public.get_my_internal_role() = 'manager' AND branch_id = public.get_my_branch());

-- Any authenticated internal user may insert only their own row (e.g. a
-- therapist completing a visit, finance confirming a transaction) — only
-- director/manager can read, per the SELECT policies above.
CREATE POLICY "al: own insert"
ON public.activity_logs FOR INSERT
WITH CHECK (user_id = auth.uid());
