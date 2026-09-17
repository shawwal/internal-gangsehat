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

  // `month=all` means all-time, not "the whole selected year" — the year
  // picker only applies once a specific month is chosen.
  const dateFrom: string | null = numMonth
    ? `${numYear}-${String(numMonth).padStart(2, '0')}-01`
    : null
  const dateTo: string | null = numMonth
    ? `${numMonth === 12 ? numYear + 1 : numYear}-${String(numMonth === 12 ? 1 : numMonth + 1).padStart(2, '0')}-01`
    : null

  const supabase = await createClient()

  // PostgREST caps any unpaginated select at 1000 rows. With `month=all` the
  // period is unbounded (all-time), so any row-returning query here can
  // easily exceed that — page through it instead of silently truncating.
  async function fetchAllRows<T>(
    factory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  ): Promise<T[]> {
    const pageSize = 1000
    const rows: T[] = []
    let from = 0
    for (;;) {
      const { data, error } = await factory(from, from + pageSize - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      rows.push(...data)
      if (data.length < pageSize) break
      from += pageSize
    }
    return rows
  }

  // ── Patients seen in period — distinct patient_id from visits (patients has no branch_id) ──
  const patientRowsP = fetchAllRows<{ patient_id: string }>((from, to) => {
    let q = supabase.from('patient_visits').select('patient_id').range(from, to)
    if (dateFrom) q = q.gte('visit_date', dateFrom)
    if (dateTo)   q = q.lt('visit_date', dateTo)
    if (branchId) q = q.eq('branch_id', branchId)
    return q
  })

  // ── Staff active as of the period (branch-aware) ──────────────────────────
  let staffQ = supabase.from('internal_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .neq('role', 'non-staff')
  if (dateTo)   staffQ = staffQ.lt('created_at', dateTo)
  if (branchId) staffQ = staffQ.eq('branch_id', branchId)

  // ── Visits for period (branch-aware via patient_visits.branch_id) ─────────
  let visitQ = supabase.from('patient_visits').select('id', { count: 'exact', head: true })
  if (dateFrom) visitQ = visitQ.gte('visit_date', dateFrom)
  if (dateTo)   visitQ = visitQ.lt('visit_date', dateTo)
  if (branchId) visitQ = visitQ.eq('branch_id', branchId)

  // ── Active packages as of the period (branch-aware via patient_packages.branch_id) ──
  let packageQ = supabase.from('patient_packages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
  if (dateTo)   packageQ = packageQ.lt('created_at', dateTo)
  if (branchId) packageQ = packageQ.eq('branch_id', branchId)

  // ── Income for period — use harga-discount (net billed) not amount (collected) ──
  const incomeRowsP = fetchAllRows<{ harga: number | null; discount: number | null }>((from, to) => {
    let q = supabase.from('transactions')
      .select('harga, discount')
      .eq('type', 'income')
      .neq('status', 'rejected')
      .range(from, to)
    if (dateFrom) q = q.gte('transaction_date', dateFrom)
    if (dateTo)   q = q.lt('transaction_date', dateTo)
    if (branchId) q = q.eq('branch_id', branchId)
    return q
  })

  // ── Expense for period ────────────────────────────────────────────────────
  const expenseRowsP = fetchAllRows<{ amount: number }>((from, to) => {
    let q = supabase.from('transactions')
      .select('amount')
      .eq('type', 'expense')
      .neq('status', 'rejected')
      .range(from, to)
    if (dateFrom) q = q.gte('transaction_date', dateFrom)
    if (dateTo)   q = q.lt('transaction_date', dateTo)
    if (branchId) q = q.eq('branch_id', branchId)
    return q
  })

  // ── Monthly trend chart: last 12 months ──────────────────────────────────
  const now = new Date()
  const trend12From = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split('T')[0]
  const trendRowsP = fetchAllRows<{ amount: number; harga: number | null; discount: number | null; type: string; transaction_date: string }>((from, to) => {
    let q = supabase.from('transactions')
      .select('amount, harga, discount, type, transaction_date')
      .neq('status', 'rejected')
      .gte('transaction_date', trend12From)
      .order('transaction_date')
      .range(from, to)
    if (branchId) q = q.eq('branch_id', branchId)
    return q
  })

  // ── Branch comparison chart: same period as the KPI boxes ──────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const branchRowsP = fetchAllRows<any>((from, to) => {
    let q = supabase.from('transactions')
      .select('amount, harga, discount, type, branch_id, branches(name)')
      .neq('status', 'rejected')
      .range(from, to)
    if (dateFrom) q = q.gte('transaction_date', dateFrom)
    if (dateTo)   q = q.lt('transaction_date', dateTo)
    return q
  })

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
    patientVisitRows,
    { count: totalStaff },
    { count: visits },
    { count: activePackages },
    incomeData,
    expenseData,
    trendTx,
    branchTx,
    { data: pendingReports },
    { data: pendingTargets },
  ] = await Promise.all([
    branchListQ,
    patientRowsP,
    staffQ,
    visitQ,
    packageQ,
    incomeRowsP,
    expenseRowsP,
    trendRowsP,
    branchRowsP,
    pendingReportsQ,
    pendingTargetsQ,
  ])

  const totalPatients = new Set(patientVisitRows.map(r => r.patient_id)).size

  const totalIncome  = incomeData.reduce((s, r) => s + Number(r.harga ?? 0) - Number(r.discount ?? 0), 0)
  const totalExpense = expenseData.reduce((s, r) => s + Number(r.amount), 0)

  const trendData  = buildTrendFromTransactions(trendTx)
  const branchData = branchId ? [] : buildBranchChartFromTransactions(branchTx, branchList)

  const MONTH_LABELS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des']
  const periodLabel = numMonth
    ? `${MONTH_LABELS[numMonth - 1]} ${year}`
    : 'Semua Waktu'

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
