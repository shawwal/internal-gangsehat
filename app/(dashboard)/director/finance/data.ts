import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import {
  MONTH_LABELS, PAGE_SIZE, type BranchSummary, type TransactionRow, type FinanceParams,
} from '@/components/director/finance/types'

interface RawSearchParams {
  branch?: string
  month?: string
  year?: string
  page?: string
  q?: string
  no_patient?: string
  tx_type?: string
  status?: string
  pay_status?: string
}

export function parseFinanceParams(params: RawSearchParams): FinanceParams {
  return {
    branchId:  params.branch ?? '',
    month:     params.month  ?? '',
    year:      params.year   ?? String(new Date().getFullYear()),
    q:         params.q?.trim() ?? '',
    noPatient: params.no_patient === '1',
    txType:    params.tx_type === 'income' ? 'income' : params.tx_type === 'expense' ? 'expense' : '',
    status:    params.status === 'pending' || params.status === 'confirmed' || params.status === 'rejected' ? params.status : '',
    payStatus: params.pay_status === 'LUNAS' || params.pay_status === 'DP' || params.pay_status === 'PELUNASAN' ? params.pay_status : '',
    page:      Math.max(1, Number(params.page) || 1),
  }
}

export async function loadFinanceData(params: FinanceParams) {
  const { branchId, month, year, q, noPatient, txType, status, payStatus, page } = params
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  const numYear  = Number(year)
  const numMonth = month ? Number(month) : null

  const dateFrom = numMonth
    ? `${numYear}-${String(numMonth).padStart(2, '0')}-01`
    : `${numYear}-01-01`
  const dateTo = numMonth
    ? `${numMonth === 12 ? numYear + 1 : numYear}-${String(numMonth === 12 ? 1 : numMonth + 1).padStart(2, '0')}-01`
    : `${numYear + 1}-01-01`

  const periodLabel = numMonth
    ? `${MONTH_LABELS[numMonth - 1]} ${year}`
    : `Tahun ${year}`

  // Params preserved across filter/pagination links (excludes page so links can override it)
  const baseParams: Record<string, string> = {}
  if (branchId)  baseParams.branch     = branchId
  if (month)     baseParams.month      = month
  if (year)      baseParams.year       = year
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

  // ── Parallel: branches, aggregate txns, paginated txns ────────────────────
  const [
    { data: branchList },
    { data: aggTxns },
    { data: txnRows, count: txnTotal },
  ] = await Promise.all([
    supabase.from('branches').select('id, name').eq('is_active', true).order('name'),

    // All txns for aggregate — always excludes rejected regardless of the list-level status
    // filter, since KPI cards / branch summary represent valid (non-voided) revenue.
    // .limit(99999) overrides PostgREST's default 1000-row cap
    (async () => {
      let q2 = supabase
        .from('transactions')
        .select('branch_id, type, harga, discount, amount, outstanding, branches!branch_id(name)')
        .neq('status', 'rejected')
        .gte('transaction_date', dateFrom)
        .lt('transaction_date', dateTo)
        .limit(99999)
      if (branchId) q2 = q2.eq('branch_id', branchId)
      return q2
    })(),

    // Paginated + searchable + filterable transactions
    (async () => {
      let q2 = supabase
        .from('transactions')
        .select(
          'id, branch_id, patient_id, type, category, harga, discount, amount, outstanding, payment_method, payment_status, status, transaction_date, description, penjamin, branches!branch_id(name)',
          { count: 'exact' },
        )
        .gte('transaction_date', dateFrom)
        .lt('transaction_date', dateTo)
        .order('transaction_date', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)

      if (branchId)  q2 = q2.eq('branch_id', branchId)
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
    })(),
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

  // ── Batch-decrypt patient names for current page ───────────────────────────
  const patientIds = [...new Set((txnRows ?? []).map(r => r.patient_id).filter(Boolean))]
  const nameMap = new Map<string, string>()
  if (patientIds.length > 0) {
    const { data: patients } = await supabase
      .from('patients')
      .select('id, encrypted_name, encrypted_phone')
      .in('id', patientIds)
    for (const p of patients ?? []) {
      try {
        const dec = decryptPatientPII({ encrypted_name: p.encrypted_name ?? '', encrypted_phone: p.encrypted_phone ?? '' })
        nameMap.set(p.id, dec.name || 'Pasien')
      } catch { nameMap.set(p.id, 'Pasien') }
    }
  }

  const txns: TransactionRow[] = (txnRows ?? []).map(r => ({
    ...r,
    patient_name: r.patient_id ? (nameMap.get(r.patient_id) ?? 'Pasien') : null,
    branch_name:  ((r.branches as unknown as { name: string } | null))?.name ?? '—',
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
    selectedBranchName,
    baseParams,
  }
}
