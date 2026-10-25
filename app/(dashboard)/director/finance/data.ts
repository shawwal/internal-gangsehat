import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { fetchAllRows, fetchInChunks } from '@/lib/supabase/fetchAll'
import { resolveTherapistNames } from '@/lib/finance/therapists'
import { UUID_RE, byDateDesc, isServiceCategory, selectAttributedTransactions, type QueryBuilder } from '@/lib/finance/attribution'
import {
  MONTH_LABELS, PAGE_SIZE, PERIOD_SEMESTERS, currentSemester, isFinancePeriod,
  type BranchSummary, type TransactionRow, type FinanceParams,
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
  sort?: string
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

/** `savedPeriod` = the browser's remembered period (cookie), used when the URL has none. */
export function parseFinanceParams(params: RawSearchParams, savedPeriod?: string): FinanceParams {
  const month = isFinancePeriod(params.month) ? params.month
    : isFinancePeriod(savedPeriod) ? savedPeriod
    : currentSemester()
  return {
    branchId:  params.branch ?? '',
    month,
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
    sort:      params.sort === 'patient_asc' || params.sort === 'patient_desc' ? params.sort : '',
    page:      Math.max(1, Number(params.page) || 1),
  }
}

/** `all` = every row matching the filters instead of the current page (Excel export). */
export async function loadFinanceData(params: FinanceParams, { all = false }: { all?: boolean } = {}) {
  const { branchId, month, year, from: rangeFrom, to: rangeTo, therapist, category, q, noPatient, txType, status, payStatus, sort, page } = params
  const hasRange = !!(rangeFrom || rangeTo)
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  const numYear  = Number(year)
  const semester = month === 's1' || month === 's2' ? month : null
  const numMonth = Number(month) || null

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
  } else if (semester) {
    dateFrom = semester === 's1' ? `${numYear}-01-01` : `${numYear}-07-01`
    dateTo   = semester === 's1' ? `${numYear}-07-01` : `${numYear + 1}-01-01`
    periodLabel = `${PERIOD_SEMESTERS[semester]} ${year}`
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
  if (sort)      baseParams.sort       = sort

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
  const sortByPatient = sort === 'patient_asc' || sort === 'patient_desc'
  const patientAsc = sort === 'patient_asc'
  type AggRow  = { branch_id: string; type: string; harga: number | null; discount: number | null; amount: number | null; outstanding: number | null; branches: unknown }
  type ListRow = Omit<TransactionRow, 'patient_name' | 'branch_name' | 'therapist' | 'service_name'> & { visit_id: string | null; fisio_id: string | null; branches: unknown }

  // Sort by patient name. Names are encrypted and transactions.patient_id has
  // no FK to patients (so PostgREST can't embed/order by it) — look up the
  // plaintext patients.name_normalized for the rows' patients in chunks (keeps
  // URLs short) and sort in memory. Rows without a name go last; ties newest first.
  type SortRow = { id: string; patient_id: string | null; transaction_date: string }
  async function sortRowsByPatient<T extends SortRow>(rows: T[]): Promise<T[]> {
    const ids = [...new Set(rows.map(r => r.patient_id).filter((id): id is string => !!id))]
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += 150) chunks.push(ids.slice(i, i + 150))
    const results = await Promise.all(chunks.map(c => supabase.from('patients').select('id, name_normalized').in('id', c)))
    const names = new Map<string, string>()
    for (const { data } of results) for (const p of data ?? []) if (p.name_normalized) names.set(p.id, p.name_normalized)
    const nameOf = (r: SortRow) => (r.patient_id ? names.get(r.patient_id) : undefined) ?? null
    return rows.sort((a, b) => {
      const na = nameOf(a), nb = nameOf(b)
      if (na === nb) return byDateDesc(a, b)
      if (na === null) return 1
      if (nb === null) return -1
      return patientAsc ? na.localeCompare(nb, 'id') : nb.localeCompare(na, 'id')
    })
  }

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
    // Read in 1000-row pages: the server caps every response at 1000 rows
    // (.limit() can't raise it), which silently under-counted long periods.
    therapist
      ? selectAttributedTransactions<AggRow>(supabase, AGG_COLS, therapist, (q2) => applyScope(q2.neq('status', 'rejected')))
      : fetchAllRows<AggRow>((f, t) => applyScope(supabase.from('transactions').select(AGG_COLS).neq('status', 'rejected')).order('id').range(f, t)),

    // Paginated + searchable + filterable transactions. With a therapist the
    // two attributed queries are merged, so paginate in memory (one
    // therapist's rows — small).
    therapist
      ? selectAttributedTransactions<ListRow>(supabase, LIST_COLS, therapist, (q2) => applyListFilters(applyScope(q2)))
          .then(async (rows) => {
            if (sortByPatient) await sortRowsByPatient(rows)
            else rows.sort(byDateDesc)
            return { rows: all ? rows : rows.slice(from, to + 1), total: rows.length }
          })
      : sortByPatient
      // Sort keys for the whole filtered list (3 light columns), then full
      // rows for the current page only.
      // The server caps a response at 1000 rows regardless of .limit(), so
      // read the keys in 1000-row pages (first page gives the count).
      ? (async () => {
          const keyPage = (i: number, withCount = false) => applyListFilters(applyScope(
            supabase.from('transactions').select('id, patient_id, transaction_date', withCount ? { count: 'exact' } : undefined),
          )).order('id').range(i, i + 999) as Promise<{ data: SortRow[] | null; count: number | null; error: { message: string } | null }>
          const first = await keyPage(0, true)
          if (first.error) throw new Error(first.error.message)
          const rest = []
          for (let i = 1000; i < (first.count ?? 0); i += 1000) rest.push(keyPage(i))
          const pages = await Promise.all(rest)
          for (const pg of pages) if (pg.error) throw new Error(pg.error.message)
          const keys = await sortRowsByPatient([first, ...pages].flatMap(pg => pg.data ?? []))
          const pageIds = (all ? keys : keys.slice(from, to + 1)).map(k => k.id)
          if (pageIds.length === 0) return { rows: [], total: keys.length }
          const data = await fetchInChunks<ListRow>(pageIds, c => supabase.from('transactions').select(LIST_COLS).in('id', c) as unknown as PromiseLike<{ data: ListRow[] | null; error: unknown }>)
          const byId = new Map(data.map(row => [row.id, row]))
          return { rows: pageIds.map(id => byId.get(id)).filter((row): row is ListRow => !!row), total: keys.length }
        })()
      : all
      ? fetchAllRows<ListRow>((f, t) => applyListFilters(applyScope(
          supabase.from('transactions').select(LIST_COLS),
        )).order('transaction_date', { ascending: false }).order('id', { ascending: false }).range(f, t))
          .then(rows => ({ rows, total: rows.length }))
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
  type PatientRow = { id: string; encrypted_name: string | null; encrypted_phone: string | null }
  const [patients, therapistMap] = await Promise.all([
    fetchInChunks<PatientRow>(patientIds as string[], c => supabase.from('patients').select('id, encrypted_name, encrypted_phone').in('id', c)),
    resolveTherapistNames(supabase, txnRows ?? []),
  ])

  // Service name from the branch price list (director/layanan): the visit's
  // booked layanan, else the branch's layanan in this category at this price,
  // else the category's only layanan.
  const rows = txnRows ?? []
  const visitIds = [...new Set(rows.map(r => r.visit_id).filter((id): id is string => !!id))]
  const txBranchIds = [...new Set(rows.map(r => r.branch_id).filter(Boolean))]
  const [visits, { data: layananRows }] = await Promise.all([
    fetchInChunks<{ id: string; layanan_id: string | null }>(visitIds, c => supabase.from('patient_visits').select('id, layanan_id').in('id', c)),
    txBranchIds.length > 0
      ? supabase.from('internal_layanan').select('id, branch_id, nama, kategori, harga').in('branch_id', txBranchIds)
      : Promise.resolve({ data: [] as { id: string; branch_id: string; nama: string; kategori: string; harga: number }[] }),
  ])
  const visitLayanan = new Map(visits.map(v => [v.id, v.layanan_id]))
  const layananById = new Map((layananRows ?? []).map(l => [l.id, l]))
  function serviceName(r: { branch_id: string; category: string; harga: number | null; visit_id: string | null }): string | null {
    const booked = r.visit_id ? visitLayanan.get(r.visit_id) : null
    if (booked && layananById.has(booked)) return layananById.get(booked)!.nama
    const sameCat = (layananRows ?? []).filter(l => l.branch_id === r.branch_id && l.kategori === r.category)
    const byPrice = sameCat.filter(l => Number(l.harga) === Number(r.harga))
    if (byPrice.length === 1) return byPrice[0].nama
    if (sameCat.length === 1) return sameCat[0].nama
    return null
  }

  for (const p of patients) {
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
    service_name: r.type === 'income' ? serviceName(r) : null,
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
