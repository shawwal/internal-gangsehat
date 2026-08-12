import { AddTransactionSheet } from '@/components/director/finance/AddTransactionSheet'
import { FinanceFilterBar } from '@/components/director/finance/FinanceFilterBar'
import { FinanceKpiCards } from '@/components/director/finance/FinanceKpiCards'
import { BranchSummaryTable } from '@/components/director/finance/BranchSummaryTable'
import { TransactionsToolbar } from '@/components/director/finance/TransactionsToolbar'
import { TransactionsTable } from '@/components/director/finance/TransactionsTable'
import { TransactionsPagination } from '@/components/director/finance/TransactionsPagination'
import { Landmark } from 'lucide-react'
import { loadFinanceData, parseFinanceParams } from './data'

export const dynamic = 'force-dynamic'

export default async function DirectorFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; month?: string; year?: string; page?: string; q?: string; no_patient?: string; tx_type?: string; status?: string; pay_status?: string }>
}) {
  const rawParams = await searchParams
  const params = parseFinanceParams(rawParams)

  const {
    branchList, branchSummaries,
    totalIncome, totalCollected, totalExpense, totalOutstanding, totalNet,
    txns, txnTotal, totalPages,
    periodLabel, selectedBranchName, baseParams,
  } = await loadFinanceData(params)

  return (
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
          <AddTransactionSheet branches={branchList} />
          <FinanceFilterBar
            branches={branchList}
            baseParams={baseParams}
            branchId={params.branchId}
            month={params.month}
            year={params.year}
          />
        </div>
      </div>

      <FinanceKpiCards
        totalIncome={totalIncome}
        totalCollected={totalCollected}
        totalOutstanding={totalOutstanding}
        totalExpense={totalExpense}
        totalNet={totalNet}
      />

      <BranchSummaryTable
        branches={branchSummaries}
        periodLabel={periodLabel}
        totalIncome={totalIncome}
        totalCollected={totalCollected}
        totalOutstanding={totalOutstanding}
        totalExpense={totalExpense}
        totalNet={totalNet}
      />

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
          showBranchColumn={!params.branchId}
          q={params.q}
          baseParams={baseParams}
        />

        <TransactionsPagination
          page={params.page}
          totalPages={totalPages}
          total={txnTotal}
          baseParams={baseParams}
        />
      </div>
    </div>
  )
}
