import { createClient } from '@/lib/supabase/server'
import { ChartsSection } from '@/components/dashboard/charts/ChartsSection'
import { KpiCards } from '@/components/overview/KpiCards'
import { PendingTargets } from '@/components/overview/PendingTargets'
import { PendingReports } from '@/components/overview/PendingReports'
import { BranchFilter } from '@/components/overview/BranchFilter'
import { buildTrendFromTransactions, buildBranchChartFromTransactions } from '@/components/overview/dataHelpers'

export const dynamic = 'force-dynamic'

export default async function DirectorOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; month?: string; year?: string }>
}) {
  const params   = await searchParams
  const branchId = params.branch ?? ''
  // No `month` param at all → first load, default to the current month.
  // `month=all` → user explicitly picked "Semua Bulan" (whole year).
  const month    = params.month ?? String(new Date().getMonth() + 1)
  const year     = params.year  ?? String(new Date().getFullYear())
  const numYear  = Number(year)
  const numMonth = month === 'all' ? null : Number(month)

  const dateFrom = numMonth
    ? `${numYear}-${String(numMonth).padStart(2, '0')}-01`
    : `${numYear}-01-01`
  const dateTo = numMonth
    ? `${numMonth === 12 ? numYear + 1 : numYear}-${String(numMonth === 12 ? 1 : numMonth + 1).padStart(2, '0')}-01`
    : `${numYear + 1}-01-01`

  const supabase = await createClient()

  // ── Patients seen in period — distinct patient_id from visits (patients has no branch_id) ──
  let patientQ = supabase.from('patient_visits')
    .select('patient_id')
    .gte('visit_date', dateFrom)
    .lt('visit_date', dateTo)
  if (branchId) patientQ = patientQ.eq('branch_id', branchId)

  // ── Staff active as of the period (branch-aware) ──────────────────────────
  let staffQ = supabase.from('internal_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .neq('role', 'non-staff')
    .lt('created_at', dateTo)
  if (branchId) staffQ = staffQ.eq('branch_id', branchId)

  // ── Visits for period (branch-aware via patient_visits.branch_id) ─────────
  let visitQ = supabase.from('patient_visits')
    .select('id', { count: 'exact', head: true })
    .gte('visit_date', dateFrom)
    .lt('visit_date', dateTo)
  if (branchId) visitQ = visitQ.eq('branch_id', branchId)

  // ── Active packages as of the period (branch-aware via patient_packages.branch_id) ──
  let packageQ = supabase.from('patient_packages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .lt('created_at', dateTo)
  if (branchId) packageQ = packageQ.eq('branch_id', branchId)

  // ── Income for period — use harga-discount (net billed) not amount (collected) ──
  let incomeQ = supabase.from('transactions')
    .select('harga, discount')
    .eq('type', 'income')
    .neq('status', 'rejected')
    .gte('transaction_date', dateFrom)
    .lt('transaction_date', dateTo)
  if (branchId) incomeQ = incomeQ.eq('branch_id', branchId)

  // ── Expense for period ────────────────────────────────────────────────────
  let expenseQ = supabase.from('transactions')
    .select('amount')
    .eq('type', 'expense')
    .neq('status', 'rejected')
    .gte('transaction_date', dateFrom)
    .lt('transaction_date', dateTo)
  if (branchId) expenseQ = expenseQ.eq('branch_id', branchId)

  // ── Monthly trend chart: last 12 months ──────────────────────────────────
  const now = new Date()
  const trend12From = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split('T')[0]
  let trendQ = supabase.from('transactions')
    .select('amount, harga, discount, type, transaction_date')
    .neq('status', 'rejected')
    .gte('transaction_date', trend12From)
    .order('transaction_date')
  if (branchId) trendQ = trendQ.eq('branch_id', branchId)

  // ── Branch comparison chart: full year ────────────────────────────────────
  const branchChartQ = supabase.from('transactions')
    .select('amount, harga, discount, type, branch_id, branches(name)')
    .neq('status', 'rejected')
    .gte('transaction_date', `${numYear}-01-01`)
    .lt('transaction_date', `${numYear + 1}-01-01`)

  // ── Pending lists ─────────────────────────────────────────────────────────
  const pendingReportsQ = supabase.from('branch_financial_reports')
    .select('id, period_year, period_month, branches(name), submitted_at')
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false })
    .limit(5)

  const pendingTargetsQ = supabase.from('staff_targets')
    .select('id, bulan, tahun, internal_profiles(full_name), branches(name), created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5)

  // ── Branches list for selector ────────────────────────────────────────────
  const branchListQ = supabase.from('branches').select('id, name').eq('is_active', true).order('name')

  // ── Execute all in parallel ───────────────────────────────────────────────
  const [
    { data: branchList },
    { data: patientVisitRows },
    { count: totalStaff },
    { count: visits },
    { count: activePackages },
    { data: incomeData },
    { data: expenseData },
    { data: trendTx },
    { data: branchTx },
    { data: pendingReports },
    { data: pendingTargets },
  ] = await Promise.all([
    branchListQ,
    patientQ,
    staffQ,
    visitQ,
    packageQ,
    incomeQ,
    expenseQ,
    trendQ,
    branchChartQ,
    pendingReportsQ,
    pendingTargetsQ,
  ])

  const totalPatients = new Set((patientVisitRows ?? []).map(r => r.patient_id)).size

  const totalIncome  = (incomeData  ?? []).reduce((s, r) => s + Number(r.harga ?? 0) - Number(r.discount ?? 0), 0)
  const totalExpense = (expenseData ?? []).reduce((s, r) => s + Number(r.amount), 0)

  const trendData  = buildTrendFromTransactions(trendTx)
  const branchData = branchId ? [] : buildBranchChartFromTransactions(branchTx, branchList)

  const MONTH_LABELS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des']
  const periodLabel = numMonth
    ? `${MONTH_LABELS[numMonth - 1]} ${year}`
    : `Tahun ${year}`

  const selectedBranchName = branchId
    ? ((branchList ?? []).find(b => b.id === branchId)?.name ?? '...')
    : 'Semua Cabang'

  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-6 relative">
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {selectedBranchName} · {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <BranchFilter
            branches={branchList ?? []}
            branchId={branchId}
            month={month}
            year={year}
          />
          <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-2xl hidden sm:block">
            {dateStr}
          </span>
        </div>
      </div>

      <KpiCards
        totalPatients={totalPatients ?? 0}
        totalStaff={totalStaff ?? 0}
        visits={visits ?? 0}
        activePackages={activePackages ?? 0}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        periodLabel={periodLabel}
      />

      <ChartsSection branchData={branchData} trendData={trendData} />

      <PendingTargets pendingTargets={pendingTargets ?? []} />
      <PendingReports pendingReports={pendingReports ?? []} />
    </div>
  )
}
