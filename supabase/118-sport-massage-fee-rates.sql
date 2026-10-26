-- Sport Massage payroll fee: Rp per attended session, per therapist per Layanan
-- (internal_layanan row). staff_id NULL = the branch default for that Layanan,
-- used when the therapist has no own rate. Read by /jadwal-sport-massage/payroll.
-- Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.sport_massage_fee_rates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  staff_id    uuid REFERENCES public.internal_profiles(id) ON DELETE CASCADE,
  layanan_id  uuid NOT NULL REFERENCES public.internal_layanan(id) ON DELETE CASCADE,
  fee         numeric NOT NULL CHECK (fee >= 0),
  updated_by  uuid REFERENCES public.internal_profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sport_massage_fee_rates_unique UNIQUE NULLS NOT DISTINCT (branch_id, staff_id, layanan_id)
);

CREATE INDEX IF NOT EXISTS idx_sport_massage_fee_rates_branch ON public.sport_massage_fee_rates(branch_id);

ALTER TABLE public.sport_massage_fee_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sm_fee_rates_director" ON public.sport_massage_fee_rates;
CREATE POLICY "sm_fee_rates_director" ON public.sport_massage_fee_rates FOR ALL
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');

DROP POLICY IF EXISTS "sm_fee_rates_manager" ON public.sport_massage_fee_rates;
CREATE POLICY "sm_fee_rates_manager" ON public.sport_massage_fee_rates FOR ALL
  USING (get_my_internal_role() = 'manager' AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() = 'manager' AND branch_id = get_my_branch());

-- Admin reads own branch; HR reads every branch (payroll is cross-branch for HR, migration 107).
DROP POLICY IF EXISTS "sm_fee_rates_read" ON public.sport_massage_fee_rates;
CREATE POLICY "sm_fee_rates_read" ON public.sport_massage_fee_rates FOR SELECT
  USING (
    get_my_internal_role() = 'hr'
    OR (get_my_internal_role() = 'admin' AND branch_id = get_my_branch())
  );
