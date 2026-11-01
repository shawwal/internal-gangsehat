// Which branches a payroll page serves: 'griya' = Griya Anak branches
// (/griya-anak/penggajian), 'clinic' = every other branch (/payroll).
// Same tables and engine either way — only the branch list differs.

import type { SupabaseClient } from '@supabase/supabase-js'

export type PayrollScope = 'clinic' | 'griya'

export const PAYROLL_HOME: Record<PayrollScope, string> = {
  clinic: '/payroll',
  griya: '/griya-anak/penggajian',
}

/** Active branches the caller may open on a payroll page of `scope`. Server-side only. */
export async function payrollBranchesFor(
  supabase: SupabaseClient, role: string, branchId: string | null, scope: PayrollScope,
): Promise<{ id: string; name: string }[]> {
  let q = supabase.from('branches').select('id, name').eq('is_active', true).order('name')
  // Director and HR (migration 107) work on every branch; others stay on their own.
  if (role !== 'director' && role !== 'hr') q = q.eq('id', branchId ?? '')
  const [{ data }, { data: griya }] = await Promise.all([
    q,
    supabase.from('branch_griya_settings').select('branch_id').eq('enabled', true),
  ])
  const griyaIds = new Set((griya ?? []).map((r) => r.branch_id as string))
  return ((data ?? []) as { id: string; name: string }[]).filter((b) => griyaIds.has(b.id) === (scope === 'griya'))
}

/** Deep link to a period on the page that serves its branch. Server-side only. */
export async function payrollPeriodLink(supabase: SupabaseClient, branchId: string, periodId: string): Promise<string> {
  const { data } = await supabase.from('branch_griya_settings').select('enabled').eq('branch_id', branchId).maybeSingle()
  return `${PAYROLL_HOME[data?.enabled ? 'griya' : 'clinic']}?period=${periodId}`
}
