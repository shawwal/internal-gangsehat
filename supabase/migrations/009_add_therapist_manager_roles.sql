-- ============================================================
-- Migration 009: Add 'therapist' and 'manager' roles
--
-- therapist: branch-scoped clinical staff.
--   Accesses patient_visits (own branch), own attendance, own
--   leave requests, own targets, own profile.
--   Falls through existing branch-scoped policies for most tables.
--
-- manager: branch-scoped director equivalent.
--   Full access within own branch across all domains:
--   patients, finance, HR, marketing, campaigns, targets.
--   branch_id must be set (NULL is not allowed for manager).
-- ============================================================

ALTER TYPE internal_user_role ADD VALUE IF NOT EXISTS 'therapist';
ALTER TYPE internal_user_role ADD VALUE IF NOT EXISTS 'manager';

-- ── NOTE: therapist ──────────────────────────────────────────
-- No new policies needed. Existing policies already cover therapist:
--   "pv: branch staff"  → patient_visits ALL for branch_id = get_my_branch()
--   "att: own read"     → attendance SELECT own rows
--   "lr: own"           → leave_requests ALL own rows
--   "ip: own read/update" → internal_profiles own row
--   "branches: staff reads" → branches SELECT own branch
--   "st: own all"       → staff_targets ALL own rows
--   migration 008 RLS   → patients SELECT (internal staff)

-- ── RLS: manager → transactions ──────────────────────────────
DROP POLICY IF EXISTS "tx: manager branch" ON public.transactions;
CREATE POLICY "tx: manager branch"
  ON public.transactions FOR ALL
  USING  (get_my_internal_role() = 'manager' AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() = 'manager' AND branch_id = get_my_branch());

-- ── RLS: manager → branch_financial_reports ──────────────────
DROP POLICY IF EXISTS "bfr: manager branch" ON public.branch_financial_reports;
CREATE POLICY "bfr: manager branch"
  ON public.branch_financial_reports FOR ALL
  USING  (get_my_internal_role() = 'manager' AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() = 'manager' AND branch_id = get_my_branch());

-- ── RLS: manager → attendance ────────────────────────────────
DROP POLICY IF EXISTS "att: manager branch" ON public.attendance;
CREATE POLICY "att: manager branch"
  ON public.attendance FOR ALL
  USING  (get_my_internal_role() = 'manager' AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() = 'manager' AND branch_id = get_my_branch());

-- ── RLS: manager → leave_requests ────────────────────────────
DROP POLICY IF EXISTS "lr: manager branch" ON public.leave_requests;
CREATE POLICY "lr: manager branch"
  ON public.leave_requests FOR ALL
  USING  (get_my_internal_role() = 'manager' AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() = 'manager' AND branch_id = get_my_branch());

-- ── RLS: manager → campaigns ─────────────────────────────────
DROP POLICY IF EXISTS "camp: manager branch" ON public.campaigns;
CREATE POLICY "camp: manager branch"
  ON public.campaigns FOR ALL
  USING  (get_my_internal_role() = 'manager' AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() = 'manager' AND branch_id = get_my_branch());

-- ── RLS: manager → staff_targets ─────────────────────────────
-- Manager can review/approve targets for their branch staff.
DROP POLICY IF EXISTS "st: manager branch" ON public.staff_targets;
CREATE POLICY "st: manager branch"
  ON public.staff_targets FOR ALL
  USING  (get_my_internal_role() = 'manager' AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() = 'manager' AND branch_id = get_my_branch());

-- ── RLS: manager → internal_profiles ─────────────────────────
-- Manager can read all profiles in their branch (same as HR).
DROP POLICY IF EXISTS "ip: manager reads branch" ON public.internal_profiles;
CREATE POLICY "ip: manager reads branch"
  ON public.internal_profiles FOR SELECT
  USING (get_my_internal_role() = 'manager' AND branch_id = get_my_branch());
