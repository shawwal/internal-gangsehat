-- Migration: give admin the same "full (own branch)" finance rights on
-- branch_financial_reports that finance/manager already have.
--
-- Root cause: per CLAUDE.md's role table, admin's Finances column is
-- "full (own)" — same as finance. transactions already has
-- transactions_admin_own_branch (027-admin-role.sql), but
-- branch_financial_reports never got the matching policy, so admin cannot
-- generate/submit the monthly report at /finance/reports even though the
-- page itself has no role check (it's driven purely by profile.branch_id +
-- RLS, exactly like the existing "bfr: finance branch" / "bfr: manager
-- branch" policies).
--
-- Run this in the Supabase SQL editor.

CREATE POLICY "bfr: admin branch"
ON public.branch_financial_reports
USING (
  get_my_internal_role() = 'admin'
  AND branch_id = get_my_branch()
)
WITH CHECK (
  get_my_internal_role() = 'admin'
  AND branch_id = get_my_branch()
);
