-- 131 — Missing indexes on hot tables + cheaper notification RLS
-- pg_stat_statements / pg_stat_user_tables (Nov 2026) showed patient_visits
-- with 2.4M sequential scans (37B rows read) and transactions with 367k, because
-- almost every filter column (patient_id, branch_id, staff, transaction_date,
-- visit_id, order_id) had no index — including the ones RLS (`branch_id =
-- get_my_branch()`) and patient_packages_with_stats rely on. Tables are small,
-- so plain CREATE INDEX is quick. Free-plan CPU / disk-IO relief; no behaviour
-- change.
--
-- Run this in your Supabase SQL editor.

-- patient_visits
CREATE INDEX IF NOT EXISTS patient_visits_patient_id_idx
  ON public.patient_visits (patient_id, visit_date);
CREATE INDEX IF NOT EXISTS patient_visits_branch_date_idx
  ON public.patient_visits (branch_id, visit_date);
CREATE INDEX IF NOT EXISTS patient_visits_staff_date_idx
  ON public.patient_visits (attending_staff_id, visit_date)
  WHERE attending_staff_id IS NOT NULL;

-- transactions
CREATE INDEX IF NOT EXISTS transactions_date_idx
  ON public.transactions (transaction_date);
CREATE INDEX IF NOT EXISTS transactions_branch_date_idx
  ON public.transactions (branch_id, transaction_date);
CREATE INDEX IF NOT EXISTS transactions_patient_id_idx
  ON public.transactions (patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_visit_id_idx
  ON public.transactions (visit_id) WHERE visit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_order_id_idx
  ON public.transactions (order_id) WHERE order_id IS NOT NULL;

-- patients: active list ordered by newest (Pasien page default sort)
CREATE INDEX IF NOT EXISTS patients_active_created_idx
  ON public.patients (is_active, created_at DESC);

-- user_notifications: header unread badge (runs on every dashboard mount)
CREATE INDEX IF NOT EXISTS user_notifications_user_unread_idx
  ON public.user_notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS user_notifications_role_unread_idx
  ON public.user_notifications (target_role, is_read);

-- Evaluate auth.uid() / the caller's role once per statement instead of per
-- row (initplan), and let the planner use the indexes above.
DROP POLICY IF EXISTS "notif: own" ON public.user_notifications;
CREATE POLICY "notif: own" ON public.user_notifications
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "notif: by role" ON public.user_notifications;
CREATE POLICY "notif: by role" ON public.user_notifications
  FOR SELECT USING (target_role::text = (SELECT get_my_internal_role()));

ANALYZE public.patient_visits;
ANALYZE public.transactions;
ANALYZE public.patients;
ANALYZE public.user_notifications;
