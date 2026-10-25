'use server'

import { createClient } from '@/lib/supabase/server'
import { loadFinanceData, parseFinanceParams } from './data'
import type { BranchSummary, TransactionRow } from '@/components/director/finance/types'

export interface FinanceExportData {
  periodLabel: string
  branchName: string
  /** null when the role may not see totals (same rule as the page) */
  totals: {
    income: number
    collected: number
    outstanding: number
    expense: number
    net: number
    branches: BranchSummary[]
  } | null
  txns: TransactionRow[]
}

/** Every transaction matching the page's current URL filters (not just the visible page). */
export async function fetchFinanceExport(rawParams: Record<string, string>): Promise<FinanceExportData> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Tidak terautentikasi')
  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const role = profile?.role ?? null
  const isDirector = role === 'director'
  const canSeeTotals = isDirector || role === 'finance'

  // Period is always explicit in the export request, so no cookie fallback.
  const params = parseFinanceParams(rawParams)
  if (!isDirector) params.branchId = ''

  const data = await loadFinanceData(params, { all: true })
  return {
    periodLabel: data.periodLabel,
    branchName:  data.selectedBranchName,
    totals: canSeeTotals
      ? {
          income:      data.totalIncome,
          collected:   data.totalCollected,
          outstanding: data.totalOutstanding,
          expense:     data.totalExpense,
          net:         data.totalNet,
          branches:    data.branchSummaries,
        }
      : null,
    txns: data.txns,
  }
}
