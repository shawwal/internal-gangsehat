import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { resolveTherapistNames } from '@/lib/finance/therapists'
import { UUID_RE, byDateDesc, isServiceCategory, selectAttributedTransactions, type QueryBuilder } from '@/lib/finance/attribution'
import {
  MONTH_LABELS, PAGE_SIZE, type BranchSummary, type TransactionRow, type FinanceParams,
} from '@/components/director/finance/types'

interface RawSearchParams {
  branch?: string
  month?: string
  year?: string
  from?: string
  to?: string
  therapist?: string
  category?: string
  page?: string
  q?: string
  no_patient?: string
  tx_type?: string
  status?: string
  pay_status?: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function nextDayISO(date: string) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function prevDayISO(date: string) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function formatDay(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function parseFinanceParams(params: RawSearchParams): FinanceParams {
  return {
    branchId:  params.branch ?? '',
    month:     params.month  ?? '',
    year:      params.year   ?? String(new Date().getFullYear()),
    from:      params.from && ISO_DATE.test(params.from) ? params.from : '',
    to:        params.to   && ISO_DATE.test(params.to)   ? params.to   : '',
    therapist: params.therapist && UUID_RE.test(params.therapist) ? params.therapist : '',
    category:  isServiceCategory(params.category) ? params.category : '',
    q:         params.q?.trim() ?? '',
    noPatient: params.no_patient === '1',
    txType:    params.tx_type === 'income' ? 'income' : params.tx_type === 'expense' ? 'expense' : '',
    status:    params.status === 'pending' || params.status === 'confirmed' || params.status === 'rejected' ? params.status : '',
    payStatus: params.pay_status === 'LUNAS' || params.pay_status === 'DP' || params.pay_status === 'PELUNASAN' ? params.pay_status : '',
    page:      Math.max(1, Number(params.page) || 1),
  }
}

export async function loadFinanceData(params: FinanceParams) {
  const { branchId, month, year, from: rangeFrom, to: rangeTo, therapist, category, q, noPatient, txType, status, payStatus, page } = params
  const hasRange = !!(rangeFrom || rangeTo)
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  const numYear  = Number(year)
  const numMonth = month ? Number(month) : null

  // Period as [dateFrom, dateTo) — empty string = unbounded on that side.
  // A date range (?from/?to, inclusive) takes precedence over month/year.
  let dateFrom: string
  let dateTo: string
  let periodLabel: string
  if (hasRange) {
    dateFrom = rangeFrom
    dateTo   = rangeTo ? nextDayISO(rangeTo) : ''
    periodLabel = rangeFrom && rangeTo
      ? `${formatDay(rangeFrom)} – ${formatDay(rangeTo)}`
      : rangeFrom ? `Sejak ${formatDay(rangeFrom)}` : `Sampai ${formatDay(rangeTo)}`
  } else {
    dateFrom = numMonth
      ? `${numYear}-${String(numMonth).padStart(2, '0')}-01`
      : `${numYear}-01-01`
    dateTo = numMonth
      ? `${numMonth === 12 ? numYear + 1 : numYear}-${String(numMonth === 12 ? 1 : numMonth + 1).padStart(2, '0')}-01`
      : `${numYear + 1}-01-01`
    periodLabel = numMonth
      ? `${MONTH_LABELS[numMonth - 1]} ${year}`
      : `Tahun ${year}`
  }

  // Same period as inclusive YYYY-MM-DD, for drill-down links (therapist page)
  const periodRange = {
    from: dateFrom,
    to:   hasRange ? rangeTo : dateTo ? prevDayISO(dateTo) : '',
  }

  // Params preserved across filter/pagination links (excludes page so links can override it)
  const baseParams: Record<string, string> = {}
  if (branchId)  baseParams.branch     = branchId
  if (hasRange) {
    if (rangeFrom) baseParams.from = rangeFrom
    if (rangeTo)   baseParams.to   = rangeTo
  } else {
    if (month)   baseParams.month      = month
    if (year)    baseParams.year       = year
  }
  if (therapist) baseParams.therapist  = therapist
  if (category)  baseParams.category   = category
  if (q)         baseParams.q          = q
  if (noPatient) baseParams.no_patient = '1'
  if (txType)    baseParams.tx_type    = txType
  if (status)    baseParams.status     = status
  if (payStatus) baseParams.pay_status = payStatus

  const supabase = await createClient()

  // ── Search: resolve patient IDs matching name_normalized ──────────────────
  let searchPatientIds: string[] = []
  if (q) {
    const { data: pMatches } = await supabase
      .from('patients')
      .select('id')
      .ilike('name_normalized', `%${q}%`)
      .limit(200)
    searchPatientIds = (pMatches ?? []).map(p => p.id)
  }

  const AGG_COLS  = 'branch_id, type, harga, discount, amount, outstanding, branches!branch_id(name)'
  const LIST_COLS = 'id, branch_id, patient_id, visit_id, fisio_id, type, category, harga, discount, amount, outstanding, payment_method, payment_status, status, transaction_date, description, penjamin, receipt_url, branches!branch_id(name)'
  type AggRow  = { branch_id: string; type: string; harga: number | null; discount: number | null; amount: number | null; outstanding: number | null; branches: unknown }
  type ListRow = Omit<TransactionRow, 'patient_name' | 'branch_name' | 'therapist'> & { visit_id: string | null; fisio_id: string | null; branches: unknown }

  // Scope shared by KPI aggregate and list: period, branch, service. The
  // therapist filter is applied by selectAttributedTransactions (two queries).
  const applyScope = (q2: QueryBuilder): QueryBuilder => {
    if (dateFrom) q2 = q2.gte('transaction_date', dateFrom)
    if (dateTo)   q2 = q2.lt('transaction_date', dateTo)
    if (branchId) q2 = q2.eq('branch_id', branchId)
    if (category) q2 = q2.eq('category', category)
    return q2
  }
  // List-only filters (KPIs intentionally ignore these)
  const applyListFilters = (q2: QueryBuilder): QueryBuilder => {
    if (noPatient) q2 = q2.is('patient_id', null)
    if (txType)    q2 = q2.eq('type', txType)
    if (status)    q2 = q2.eq('status', status)
    if (payStatus) q2 = q2.eq('payment_status', payStatus)
    if (q) {
      const orParts = [
        `category.ilike.%${q}%`,
        `description.ilike.%${q}%`,
        `penjamin.ilike.%${q}%`,
      ]
      if (searchPatientIds.length > 0) {
        orParts.push(`patient_id.in.(${searchPatientIds.join(',')})`)
      }
      q2 = q2.or(orParts.join(','))
    }
    return q2
  }

  // ── Parallel: branches, aggregate txns, paginated txns ────────────────────
  const [
    { data: branchList },
    aggTxns,
    { rows: txnRows, total: txnTotal },
  ] = await Promise.all([
    supabase.from('branches').select('id, name').eq('is_active', true).order('name'),

    // All txns for aggregate — always excludes rejected regardless of the list-level status
    // filter, since KPI cards / branch summary represent valid (non-voided) revenue.
    // .limit(99999) overrides PostgREST's default 1000-row cap
    therapist
      ? selectAttributedTransactions<AggRow>(supabase, AGG_COLS, therapist, (q2) => applyScope(q2.neq('status', 'rejected').limit(99999)))
      : applyScope(supabase.from('transactions').select(AGG_COLS).neq('status', 'rejected').limit(99999))
          .then((r: { data: AggRow[] | null }) => r.data ?? []) as Promise<AggRow[]>,

    // Paginated + searchable + filterable transactions. With a therapist the
    // two attributed queries are merged, so paginate in memory (one
    // therapist's rows — small).
    therapist
      ? selectAttributedTransactions<ListRow>(supabase, LIST_COLS, therapist, (q2) => applyListFilters(applyScope(q2)).limit(99999))
          .then((rows) => {
            rows.sort(byDateDesc)
            return { rows: rows.slice(from, to + 1), total: rows.length }
          })
      : applyListFilters(applyScope(
          supabase
            .from('transactions')
            .select(LIST_COLS, { count: 'exact' })
            .order('transaction_date', { ascending: false })
            .order('id', { ascending: false })
            .range(from, to),
        )).then((r: { data: ListRow[] | null; count: number | null }) => ({ rows: r.data ?? [], total: r.count ?? 0 })) as Promise<{ rows: ListRow[]; total: number }>,
  ])

  // ── Compute per-branch summary ─────────────────────────────────────────────
  const branchMap: Record<string, BranchSummary> = {}
  for (const tx of aggTxns ?? []) {
    const bid = tx.branch_id as string
    if (!branchMap[bid]) {
      branchMap[bid] = {
        name:        ((tx.branches as unknown as { name: string } | null))?.name ?? '—',
        income:      0,
        collected:   0,
        expense:     0,
        outstanding: 0,
        net:         0,
      }
    }
    if (tx.type === 'income') {
      branchMap[bid].income      += Number(tx.harga ?? 0) - Number(tx.discount ?? 0)
      branchMap[bid].collected   += Number(tx.amount ?? 0)
      branchMap[bid].outstanding += Number(tx.outstanding ?? 0)
    }
    if (tx.type === 'expense') {
      branchMap[bid].expense += Number(tx.amount ?? 0)
    }
  }
  for (const b of Object.values(branchMap)) b.net = b.income - b.expense
  const branchSummaries = Object.values(branchMap).sort((a, b) => b.income - a.income)
  const totalIncome      = branchSummaries.reduce((s, b) => s + b.income,      0)
  const totalCollected   = branchSummaries.reduce((s, b) => s + b.collected,   0)
  const totalExpense     = branchSummaries.reduce((s, b) => s + b.expense,     0)
  const totalOutstanding = branchSummaries.reduce((s, b) => s + b.outstanding, 0)
  const totalNet         = totalIncome - totalExpense

  // ── Current page: decrypt patient names + resolve therapists in parallel ──
  const patientIds = [...new Set((txnRows ?? []).map(r => r.patient_id).filter(Boolean))]
  const nameMap = new Map<string, string>()
  const [{ data: patients }, therapistMap] = await Promise.all([
    patientIds.length > 0
      ? supabase.from('patients').select('id, encrypted_name, encrypted_phone').in('id', patientIds)
      : Promise.resolve({ data: [] as { id: string; encrypted_name: string | null; encrypted_phone: string | null }[] }),
    resolveTherapistNames(supabase, txnRows ?? []),
  ])
  for (const p of patients ?? []) {
    try {
      const dec = decryptPatientPII({ encrypted_name: p.encrypted_name ?? '', encrypted_phone: p.encrypted_phone ?? '' })
      nameMap.set(p.id, dec.name || 'Pasien')
    } catch { nameMap.set(p.id, 'Pasien') }
  }

  const txns: TransactionRow[] = (txnRows ?? []).map(r => ({
    ...r,
    patient_name: r.patient_id ? (nameMap.get(r.patient_id) ?? 'Pasien') : null,
    branch_name:  ((r.branches as unknown as { name: string } | null))?.name ?? '—',
    therapist: therapistMap.get(r.id) ?? null,
  }))

  const totalPages     = Math.max(1, Math.ceil((txnTotal ?? 0) / PAGE_SIZE))
  const selectedBranchName = branchId
    ? ((branchList ?? []).find(b => b.id === branchId)?.name ?? '...')
    : 'Semua Cabang'

  return {
    branchList: branchList ?? [],
    branchSummaries,
    totalIncome,
    totalCollected,
    totalExpense,
    totalOutstanding,
    totalNet,
    txns,
    txnTotal: txnTotal ?? 0,
    totalPages,
    periodLabel,
    periodRange,
    selectedBranchName,
    baseParams,
  }
}
