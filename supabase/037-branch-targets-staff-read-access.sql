-- Migration: allow non-director/manager internal roles to read their own
-- branch's approved branch_targets row on /target-progress.
--
-- Root cause: branch_targets only had "bt: director all" and
-- "bt: manager branch" policies (015_branch_targets.sql). Every other role
-- (therapist, admin, staff, hr, finance, marketing) got zero SELECT policies,
-- so RLS default-denied their read even for their own branch's approved
-- target — target-progress/page.tsx would see targetRow=null and show
-- "0" targets / no chart, while director/manager saw real data for the
-- identical branch.

CREATE POLICY "bt: staff reads own branch approved"
ON public.branch_targets FOR SELECT
USING (
  branch_id = get_my_branch()
  AND status = 'approved'
);
