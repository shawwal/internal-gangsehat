-- Transactions RLS Policies
-- Run this in the Supabase SQL editor to fix the zero-totals issue on the director overview.
-- Requires get_my_internal_role() and get_my_branch() helper functions to exist.

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Director: full access across all branches
CREATE POLICY "transactions_director_all"
ON public.transactions FOR ALL
USING (get_my_internal_role() = 'director')
WITH CHECK (get_my_internal_role() = 'director');

-- Finance: own branch only
CREATE POLICY "transactions_finance_own_branch"
ON public.transactions FOR ALL
USING (
  get_my_internal_role() = 'finance'
  AND branch_id = get_my_branch()
)
WITH CHECK (
  get_my_internal_role() = 'finance'
  AND branch_id = get_my_branch()
);

-- Manager: own branch only
CREATE POLICY "transactions_manager_own_branch"
ON public.transactions FOR ALL
USING (
  get_my_internal_role() = 'manager'
  AND branch_id = get_my_branch()
)
WITH CHECK (
  get_my_internal_role() = 'manager'
  AND branch_id = get_my_branch()
);
