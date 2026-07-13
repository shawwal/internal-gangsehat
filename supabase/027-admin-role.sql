-- Migration: add "admin" role (branch-scoped: schedule, payments, patients, leave view-only)
-- Run this in the Supabase SQL editor.
--
-- Admin gets:
--   - patient_visits (schedule): already covered by "pv: branch staff" (branch_id match, role-agnostic)
--   - transactions (payment flow): new own-branch policy, same shape as manager/finance
--   - patients (add patient): already covered by internal-staff INSERT/SELECT policies (role-agnostic)
--   - leave_requests: SELECT-only — admin can see who applied for leave but cannot
--     approve/reject/delete; only director keeps FOR ALL on this table.

ALTER TYPE internal_user_role ADD VALUE IF NOT EXISTS 'admin';

-- Transactions: own branch only (mirrors transactions_manager_own_branch)
CREATE POLICY "transactions_admin_own_branch"
ON public.transactions FOR ALL
USING (
  get_my_internal_role() = 'admin'
  AND branch_id = get_my_branch()
)
WITH CHECK (
  get_my_internal_role() = 'admin'
  AND branch_id = get_my_branch()
);

-- Leave requests: view-only, own branch — no approve/reject/delete
CREATE POLICY "lr: admin branch view"
ON public.leave_requests FOR SELECT
USING (
  get_my_internal_role() = 'admin'
  AND branch_id = get_my_branch()
);
