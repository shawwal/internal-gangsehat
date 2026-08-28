'use server'

import { createClient } from '@/lib/supabase/server'

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

export async function addExpenseCategory(name: string): Promise<{ error: string | null }> {
  const access = await requireBranchAccess()
  if ('error' in access) return { error: access.error }
  if (!access.branchId) return { error: 'Akun Anda belum terhubung ke cabang.' }
  const supabase = await createClient()
  const { error } = await supabase.from('internal_expense_categories').insert({
    branch_id: access.branchId,
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

export async function fetchOpeningBalance(branchId: string, year: number): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('internal_cash_opening_balance')
    .select('amount')
    .eq('branch_id', branchId)
    .eq('year', year)
    .maybeSingle()
  return data ? Number(data.amount) : 0
}

export async function setOpeningBalance(year: number, amount: number): Promise<{ error: string | null }> {
  const access = await requireBranchAccess()
  if ('error' in access) return { error: access.error }
  if (!access.branchId) return { error: 'Akun Anda belum terhubung ke cabang.' }
  const supabase = await createClient()
  const { error } = await supabase.from('internal_cash_opening_balance').upsert({
    branch_id: access.branchId,
    year,
    amount,
    updated_by: access.userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'branch_id,year' })

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
}

/** Fetches confirmed+pending (non-rejected) transactions for a branch/date range, for in-app aggregation. */
export async function fetchTransactionsForRange(
  branchId: string,
  dateFrom: string,
  dateToExclusive: string,
): Promise<AccountingTxnRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('transactions')
    .select('id, type, category, amount, harga, discount, fisio_id, transaction_date, status')
    .eq('branch_id', branchId)
    .neq('status', 'rejected')
    .gte('transaction_date', dateFrom)
    .lt('transaction_date', dateToExclusive)
    .limit(99999)
  return (data ?? []) as AccountingTxnRow[]
}

export interface AdminOption { id: string; full_name: string }

export async function fetchBranchAdmins(branchId: string): Promise<AdminOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('internal_profiles')
    .select('id, full_name')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('full_name')
  return (data ?? []) as AdminOption[]
}
