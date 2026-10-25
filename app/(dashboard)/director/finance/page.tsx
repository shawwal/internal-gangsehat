import { AddTransactionSheet } from '@/components/director/finance/AddTransactionSheet'
import { FinanceFilterBar } from '@/components/director/finance/FinanceFilterBar'
import { FinanceKpiCards } from '@/components/director/finance/FinanceKpiCards'
import { BranchSummaryTable } from '@/components/director/finance/BranchSummaryTable'
import { FinanceExportButton } from '@/components/director/finance/FinanceExportButton'
import { TransactionsToolbar } from '@/components/director/finance/TransactionsToolbar'
import { TransactionsTable } from '@/components/director/finance/TransactionsTable'
import { TransactionsPagination } from '@/components/director/finance/TransactionsPagination'
import { Landmark } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { loadFinanceData, parseFinanceParams } from './data'
import { listTherapistOptions } from '@/lib/finance/therapists'
import { UrlTherapistServiceFilters } from '@/components/finance/TherapistServiceFilters'
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { FINANCE_PERIOD_COOKIE } from '@/components/director/finance/types'
import { FinancePendingProvider, FinancePendingContent } from '@/components/director/finance/FinancePending'
import { SkeletonRegion, StatCardsSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export const dynamic = 'force-dynamic'

export default async function DirectorFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; month?: string; year?: string; from?: string; to?: string; therapist?: string; category?: string; page?: string; q?: string; no_patient?: string; tx_type?: string; status?: string; pay_status?: string; sort?: string }>
}) {
  const rawParams = await searchParams
  const savedPeriod = (await cookies()).get(FINANCE_PERIOD_COOKIE)?.value
  const params = parseFinanceParams(rawParams, savedPeriod)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role, branch_id')
    .eq('id', user!.id)
    .single()
  const role = profile?.role ?? null
  const isDirector = role === 'director'
  // Totals (KPI cards + branch summary) are restricted to finance and director.
  const canSeeTotals = isDirector || role === 'finance'
  // Only director may filter by branch; everyone else is scoped by RLS.
  if (!isDirector) params.branchId = ''

  const [{
    branchList, branchSummaries,
    totalIncome, totalCollected, totalExpense, totalOutstanding, totalNet,
    txns, txnTotal, totalPages,
    periodLabel, periodRange, selectedBranchName, baseParams,
  }, therapistOptions] = await Promise.all([
    loadFinanceData(params),
    listTherapistOptions(supabase, isDirector ? params.branchId : (profile?.branch_id ?? '')),
  ])

  return (
    <FinancePendingProvider>
    <div className="space-y-6 relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Landmark size={20} className="text-primary" />
            <h1 className="text-xl font-bold text-foreground">Keuangan Cabang</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {selectedBranchName} · {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <FinanceExportButton
            baseParams={baseParams}
            therapistName={therapistOptions.find(t => t.id === params.therapist)?.name}
          />
          <AddTransactionSheet branches={branchList} />
          <FinanceFilterBar
            branches={branchList}
            baseParams={baseParams}
            branchId={params.branchId}
            showBranchSelect={isDirector}
            month={params.month}
            year={params.year}
            from={params.from}
            to={params.to}
          />
        </div>
      </div>

      <FinancePendingContent
        fallback={
          <SkeletonRegion>
            <StatCardsSkeleton count={4} />
            <TableSkeleton rows={5} cols={5} />
            <TableSkeleton rows={8} cols={6} />
          </SkeletonRegion>
        }
      >
      {/* Therapist + service: scope KPIs, branch summary and the list */}
      <Suspense>
        <UrlTherapistServiceFilters
          therapists={therapistOptions}
          therapist={params.therapist}
          category={params.category}
        />
      </Suspense>

      {canSeeTotals && (
      <FinanceKpiCards
        totalIncome={totalIncome}
        totalCollected={totalCollected}
        totalOutstanding={totalOutstanding}
        totalExpense={totalExpense}
        totalNet={totalNet}
      />
      )}

      {/* Redundant with the KPI cards above when there's only one branch to show
          (admin/manager, scoped by RLS) — director sees the real breakdown. */}
      {canSeeTotals && branchList.length > 1 && (
        <BranchSummaryTable
          branches={branchSummaries}
          periodLabel={periodLabel}
          totalIncome={totalIncome}
          totalCollected={totalCollected}
          totalOutstanding={totalOutstanding}
          totalExpense={totalExpense}
          totalNet={totalNet}
        />
      )}

      {/* Transactions section: filters + table + pagination */}
      <div className="glass-card overflow-hidden">
        <TransactionsToolbar
          baseParams={baseParams}
          q={params.q}
          txnTotal={txnTotal}
          txType={params.txType}
          noPatient={params.noPatient}
          status={params.status}
          payStatus={params.payStatus}
        />

        <TransactionsTable
          txns={txns}
          showBranchColumn={isDirector && !params.branchId}
          q={params.q}
          sort={params.sort}
          baseParams={baseParams}
          periodRange={periodRange}
        />

        <TransactionsPagination
          page={params.page}
          totalPages={totalPages}
          total={txnTotal}
          baseParams={baseParams}
        />
      </div>
      </FinancePendingContent>
    </div>
    </FinancePendingProvider>
  )
}
