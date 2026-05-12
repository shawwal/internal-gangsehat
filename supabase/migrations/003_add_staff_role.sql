-- ============================================================
-- Migration 003: Add 'staff' role
--
-- New employees who self-register land with role='staff'.
-- They have read-only access to their own profile, attendance,
-- and leave requests. The director assigns the real role
-- (finance / hr / marketing / director) afterwards.
-- ============================================================

-- Add 'staff' to the enum (safe if already present)
ALTER TYPE internal_user_role ADD VALUE IF NOT EXISTS 'staff';

-- Update trigger: new registrants default to 'staff' instead of 'marketing'
-- 'marketing' already has branch-level write access, which is too broad
-- for an unverified new hire.
CREATE OR REPLACE FUNCTION handle_new_internal_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.internal_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(COALESCE(NEW.email, 'user@x'), '@', 1)
    ),
    'staff'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Existing RLS policies already cover 'staff' correctly:
--   "ip: own read"   → staff can read their own internal_profiles row
--   "att: own read"  → staff can read their own attendance rows
--   "lr: own"        → staff can manage their own leave_requests
--   "branches: staff reads" → id = get_my_branch(); NULL branch_id returns no rows ✓
-- No additional policies needed.
