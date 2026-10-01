import type { SupabaseClient } from '@supabase/supabase-js'

export interface ReportTotals {
  total_income: number
  total_expense: number
  patient_count: number
  visit_count: number
}

const BATCH = 1000

// PostgREST caps a response at 1000 rows, so page through until exhausted.
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += BATCH) {
    const { data, error } = await build(from, from + BATCH - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < BATCH) return rows
  }
}

/**
 * Totals for one branch in one calendar month, from confirmed transactions
 * and visit records. Throws when any underlying query fails.
 */
export async function computeReportTotals(
  supabase: SupabaseClient,
  branchId: string,
  year: number,
  month: number,
): Promise<ReportTotals> {
  const mm          = String(month).padStart(2, '0')
  const lastDay     = new Date(year, month, 0).getDate()
  const periodStart = `${year}-${mm}-01`
  const periodEnd   = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`

  const [transactions, visits] = await Promise.all([
    fetchAll<{ id: string; type: string; amount: number }>((from, to) =>
      supabase.from('transactions')
        .select('id, type, amount')
        .eq('status', 'confirmed').eq('branch_id', branchId)
        .gte('transaction_date', periodStart).lte('transaction_date', periodEnd)
        .order('id')
        .range(from, to)),
    fetchAll<{ id: string; patient_id: string }>((from, to) =>
      supabase.from('patient_visits')
        .select('id, patient_id')
        .eq('branch_id', branchId)
        .gte('visit_date', periodStart).lte('visit_date', periodEnd)
        .order('id')
        .range(from, to)),
  ])

  const sum = (type: string) =>
    transactions.filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount), 0)

  return {
    total_income:  sum('income'),
    total_expense: sum('expense'),
    patient_count: new Set(visits.map((v) => v.patient_id)).size,
    visit_count:   visits.length,
  }
}
