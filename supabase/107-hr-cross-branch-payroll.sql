-- 107: HR prepares payroll (absensi, aktivitas, denda/bonus) for every branch,
-- like the director. Additive policies only — the existing own-branch ones from
-- 095 / 063 stay. Approval (lock) and "paid" remain director/manager/finance;
-- those are enforced in app/actions/payroll.ts + the 095 triggers, unchanged.
-- Slips stay read-only for HR. Global (branch_id NULL) config stays director-only.

-- ── Lookups: branch list + staff of every branch ──────────────────────────────
CREATE POLICY "branches: hr reads all" ON public.branches FOR SELECT
  USING (get_my_internal_role() = 'hr');

CREATE POLICY "ip: hr reads all branches" ON public.internal_profiles FOR SELECT
  USING (get_my_internal_role() = 'hr');

-- ── Attendance ────────────────────────────────────────────────────────────────
-- Not gated by has_table_access(): migration 063 (role_table_permissions) was
-- never applied here, so attendance still uses the hardcoded "att: hr branch".
CREATE POLICY "att: hr all branches" ON public.attendance
  USING (get_my_internal_role() = 'hr')
  WITH CHECK (get_my_internal_role() = 'hr');

-- ── Branch config ─────────────────────────────────────────────────────────────
CREATE POLICY "payroll_settings_hr_all" ON public.payroll_settings FOR ALL
  USING (get_my_internal_role() = 'hr' AND branch_id IS NOT NULL)
  WITH CHECK (get_my_internal_role() = 'hr' AND branch_id IS NOT NULL);
CREATE POLICY "payroll_deduction_rules_hr_all" ON public.payroll_deduction_rules FOR ALL
  USING (get_my_internal_role() = 'hr' AND branch_id IS NOT NULL)
  WITH CHECK (get_my_internal_role() = 'hr' AND branch_id IS NOT NULL);
CREATE POLICY "payroll_holidays_hr_all" ON public.payroll_holidays FOR ALL
  USING (get_my_internal_role() = 'hr' AND branch_id IS NOT NULL)
  WITH CHECK (get_my_internal_role() = 'hr' AND branch_id IS NOT NULL);

-- ── Employees ─────────────────────────────────────────────────────────────────
CREATE POLICY "employee_payroll_profiles_hr_all" ON public.employee_payroll_profiles FOR ALL
  USING (get_my_internal_role() = 'hr') WITH CHECK (get_my_internal_role() = 'hr');
CREATE POLICY "employee_compensation_hr_all" ON public.employee_compensation FOR ALL
  USING (get_my_internal_role() = 'hr') WITH CHECK (get_my_internal_role() = 'hr');

-- ── Periods + inputs ──────────────────────────────────────────────────────────
CREATE POLICY "payroll_periods_hr_all" ON public.payroll_periods FOR ALL
  USING (get_my_internal_role() = 'hr') WITH CHECK (get_my_internal_role() = 'hr');
CREATE POLICY "payroll_period_staff_hr_all" ON public.payroll_period_staff FOR ALL
  USING (get_my_internal_role() = 'hr') WITH CHECK (get_my_internal_role() = 'hr');
CREATE POLICY "payroll_activity_counts_hr_all" ON public.payroll_activity_counts FOR ALL
  USING (get_my_internal_role() = 'hr') WITH CHECK (get_my_internal_role() = 'hr');
CREATE POLICY "payroll_adjustments_hr_all" ON public.payroll_adjustments FOR ALL
  USING (get_my_internal_role() = 'hr') WITH CHECK (get_my_internal_role() = 'hr');

-- ── Slips: read-only ──────────────────────────────────────────────────────────
CREATE POLICY "payroll_slips_hr_read_all" ON public.payroll_slips FOR SELECT
  USING (get_my_internal_role() = 'hr');

-- patient_visits is NOT widened: the payroll auto-activity refresh reads visits
-- with the service role, scoped to staff bound to a period the caller can see.
