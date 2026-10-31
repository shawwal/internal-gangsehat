'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MANAGE_ROLES = ['finance', 'manager', 'director', 'admin']

async function requireBranchAccess(): Promise<{ userId: string; role: string; branchId: string | null } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }
  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()
  if (!profile || !MANAGE_ROLES.includes(profile.role)) return { error: 'Tidak memiliki akses' }
  return { userId: user.id, role: profile.role, branchId: profile.branch_id }
}

/** Director picks any branch; everyone else is pinned to their own. */
function targetBranch(access: { role: string; branchId: string | null }, requested?: string): string | null {
  return access.role === 'director' ? (requested ?? null) : access.branchId
}

// ── Expense categories ───────────────────────────────────────────────────────

export interface ExpenseCategoryRow {
  id: string
  branch_id: string
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export async function fetchExpenseCategories(branchId: string): Promise<ExpenseCategoryRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('internal_expense_categories')
    .select('id, branch_id, name, sort_order, is_active, created_at')
    .eq('branch_id', branchId)
    .order('sort_order')
    .order('name')
  return (data ?? []) as ExpenseCategoryRow[]
}

export async function addExpenseCategory(name: string, branchId?: string): Promise<{ error: string | null }> {
  const access = await requireBranchAccess()
  if ('error' in access) return { error: access.error }
  const branch = targetBranch(access, branchId)
  if (!branch) return { error: access.role === 'director' ? 'Pilih cabang terlebih dahulu.' : 'Akun Anda belum terhubung ke cabang.' }
  const supabase = await createClient()
  const { error } = await supabase.from('internal_expense_categories').insert({
    branch_id: branch,
    name: name.trim().toUpperCase(),
  })
  return { error: error?.message ?? null }
}

export async function renameExpenseCategory(id: string, name: string): Promise<{ error: string | null }> {
  const access = await requireBranchAccess()
  if ('error' in access) return { error: access.error }
  const supabase = await createClient()
  const { error } = await supabase
    .from('internal_expense_categories')
    .update({ name: name.trim().toUpperCase() })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function toggleExpenseCategoryActive(id: string, isActive: boolean): Promise<{ error: string | null }> {
  const access = await requireBranchAccess()
  if ('error' in access) return { error: access.error }
  const supabase = await createClient()
  const { error } = await supabase
    .from('internal_expense_categories')
    .update({ is_active: isActive })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function deleteExpenseCategory(id: string): Promise<{ error: string | null }> {
  const access = await requireBranchAccess()
  if ('error' in access) return { error: access.error }
  const supabase = await createClient()
  const { error } = await supabase.from('internal_expense_categories').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ── Cash opening balance ─────────────────────────────────────────────────────

/** Saldo Awal per semester. Semester 1 = the yearly opening (also "Tahun penuh");
 * Semester 2 is null until set — the tab then falls back to Semester 1's figure. */
export async function fetchOpeningBalance(branchId: string, year: number): Promise<{ s1: number; s2: number | null }> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('internal_cash_opening_balance')
    .select('semester, amount')
    .eq('branch_id', branchId)
    .eq('year', year)
  const s1 = data?.find((r) => r.semester === 1)
  const s2 = data?.find((r) => r.semester === 2)
  return { s1: s1 ? Number(s1.amount) : 0, s2: s2 ? Number(s2.amount) : null }
}

export async function setOpeningBalance(year: number, amount: number, branchId?: string, semester: 1 | 2 = 1): Promise<{ error: string | null }> {
  const access = await requireBranchAccess()
  if ('error' in access) return { error: access.error }
  const branch = targetBranch(access, branchId)
  if (!branch) return { error: access.role === 'director' ? 'Pilih cabang terlebih dahulu.' : 'Akun Anda belum terhubung ke cabang.' }
  const supabase = await createClient()
  const { error } = await supabase.from('internal_cash_opening_balance').upsert({
    branch_id: branch,
    year,
    semester,
    amount,
    updated_by: access.userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'branch_id,year,semester' })

  return { error: error?.message ?? null }
}

// ── Aggregation for Laporan & Arus Kas ───────────────────────────────────────

export interface AccountingTxnRow {
  id: string
  type: 'income' | 'expense'
  category: string
  amount: number
  harga: number
  discount: number
  fisio_id: string | null
  transaction_date: string
  status: string
  patient_id: string | null
  description: string | null
  payment_method: string | null
  payment_status: string | null
}

/** Fetches confirmed+pending (non-rejected) transactions for a branch/date range, for in-app aggregation. */
export async function fetchTransactionsForRange(
  branchId: string,
  dateFrom: string,
  dateToExclusive: string,
): Promise<AccountingTxnRow[]> {
  const supabase = await createClient()
  // PostgREST caps every response at 1000 rows whatever .limit() asks for, so a
  // busy branch's year was cut off mid-year — read in pages until exhausted.
  const PAGE = 1000
  const rows: AccountingTxnRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, type, category, amount, harga, discount, fisio_id, transaction_date, status, patient_id, description, payment_method, payment_status')
      .eq('branch_id', branchId)
      .neq('status', 'rejected')
      .gte('transaction_date', dateFrom)
      .lt('transaction_date', dateToExclusive)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as AccountingTxnRow[]))
    if (!data || data.length < PAGE) break
  }
  return rows
}

export interface AdminOption { id: string; full_name: string }

// Names for the ledger's "Admin" / Laporan breakdown. RLS only lets most
// roles read their own profile row, so the list came back empty for finance —
// read with the service role after the access check (names only).
export async function fetchBranchAdmins(branchId: string): Promise<AdminOption[]> {
  const access = await requireBranchAccess()
  if ('error' in access) return []
  const branch = access.role === 'director' ? branchId : access.branchId
  if (!branch) return []
  const { data } = await createAdminClient()
    .from('internal_profiles')
    .select('id, full_name')
    .eq('branch_id', branch)
    .eq('is_active', true)
    .order('full_name')
  return (data ?? []) as AdminOption[]
}
