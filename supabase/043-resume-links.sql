-- Migration: Shareable patient resume links
-- Run this in the Supabase SQL editor.
--
-- One row per generated share link for a visit's patient resume (see
-- app/actions/resumeLinks.ts). Staff generate a token from Medical Records /
-- the assessment page; the public /resume/[token] page resolves it via the
-- service-role admin client (lib/supabase/admin.ts) — never via anon/browser
-- credentials — so there is deliberately no public SELECT policy here.
--
-- branch_id is denormalized from patient_visits at insert time (same
-- convention as terapi_awal_assessments / session_notes) so RLS is a plain
-- branch_id match rather than a subquery through patient_visits.
--
-- RLS shape copied from supabase/031-terapi-awal-assessments.sql.

CREATE TABLE IF NOT EXISTS public.resume_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id     uuid NOT NULL REFERENCES public.patient_visits(id) ON DELETE CASCADE,
  branch_id    uuid NOT NULL REFERENCES public.branches(id),
  token        text NOT NULL UNIQUE,
  created_by   uuid REFERENCES public.internal_profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_resume_links_visit_id ON public.resume_links(visit_id);
CREATE INDEX IF NOT EXISTS idx_resume_links_branch_id ON public.resume_links(branch_id);

ALTER TABLE public.resume_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resume_links_director_all" ON public.resume_links FOR ALL
USING (get_my_internal_role() = 'director')
WITH CHECK (get_my_internal_role() = 'director');

CREATE POLICY "resume_links_branch_staff_all" ON public.resume_links FOR ALL
USING (branch_id = get_my_branch())
WITH CHECK (branch_id = get_my_branch());
