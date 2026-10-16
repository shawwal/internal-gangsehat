import { createClient } from '@/lib/supabase/server'
import { resolveTherapistNames } from '@/lib/finance/therapists'
import { decryptPatientPII } from '@/lib/encryption'
import { OutstandingBranchFilter } from '@/components/finance/OutstandingBranchFilter'
import { SearchInput } from '@/components/director/finance/SearchInput'
import { OutstandingRow } from '@/components/finance/OutstandingRow'
import { UrlDateRangeFilter } from '@/components/finance/DateRangeFilter'
import type { TransactionForEdit } from '@/components/director/finance/EditTransactionSheet'
import { AlertCircle, Wallet, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10
const ISO_DATE  = /^\d{4}-\d{2}-\d{2}$/

const STATUS_TABS = [
  { value: '',          label: 'Belum Lunas' },
  { value: 'DP',         label: 'DP' },
  { value: 'PELUNASAN',  label: 'Pelunasan' },
  { value: 'LUNAS',      label: 'Lunas' },
] as const

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n)
}

function buildUrl(base: Record<string, string>, overrides: Record<string, string | undefined>) {
  const p = new URLSearchParams()
  const merged = { ...base, ...overrides }
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== '') p.set(k, v)
  }
  return `/finance/outstanding?${p.toString()}`
}

export default async function OutstandingPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; page?: string; q?: string; status?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const q      = params.q?.trim() ?? ''
  const status = params.status === 'DP' || params.status === 'PELUNASAN' || params.status === 'LUNAS' ? params.status : ''
  const page   = Math.max(1, Number(params.page) || 1)
  const dateFrom = params.from && ISO_DATE.test(params.from) ? params.from : ''
  const dateTo   = params.to   && ISO_DATE.test(params.to)   ? params.to   : ''
  const from   = (page - 1) * PAGE_SIZE
  const to     = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role, branch_id')
    .eq('id', user!.id)
    .single()

  const isDirector = profile?.role === 'director'
  const branchId   = isDirector ? (params.branch ?? '') : (profile?.branch_id ?? '')

  const baseParams: Record<string, string> = {}
  if (branchId) baseParams.branch = branchId
  if (q)        baseParams.q      = q
  if (status)   baseParams.status = status
  if (dateFrom) baseParams.from   = dateFrom
  if (dateTo)   baseParams.to     = dateTo

  // ── Search: resolve patient IDs matching name_normalized ──────────────────
  let searchPatientIds: string[] = []
  if (q) {
    const { data: pMatches } = await supabase
      .from('patients')
      .select('id')
      .ilike('name_normalized', `%${q}%`)
      .limit(200)
    searchPatientIds = (pMatches ?? []).map((p) => p.id)
  }

  const [{ data: branchList }, { data: aggRows }, { data: txnRows, count: txnTotal }] = await Promise.all([
    isDirector
      ? supabase.from('branches').select('id, name').eq('is_active', true).order('name')
      : Promise.resolve({ data: [] }),

    // Unpaginated aggregate — total outstanding + count, same branch + date scope, no search filter
    (async () => {
      let q2 = supabase
        .from('transactions')
        .select('outstanding')
        .eq('type', 'income')
        .neq('status', 'rejected')
        .gt('outstanding', 0)
        .limit(99999)
      if (branchId) q2 = q2.eq('branch_id', branchId)
      if (dateFrom) q2 = q2.gte('transaction_date', dateFrom)
      if (dateTo)   q2 = q2.lte('transaction_date', dateTo)
      return q2
    })(),

    // Paginated + searchable outstanding transactions
    (async () => {
      let q2 = supabase
        .from('transactions')
        .select(
          'id, order_id, branch_id, patient_id, visit_id, fisio_id, category, harga, discount, amount, outstanding, payment_method, payment_status, transaction_date, description, penjamin, receipt_url, branches!branch_id(name)',
          { count: 'exact' },
        )
        .eq('type', 'income')
        .neq('status', 'rejected')
        .order('transaction_date', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)

      // "Belum Lunas" (default) covers DP + Pelunasan via outstanding > 0.
      // "Lunas" breaks out of that framing on purpose — a paid-off row has
      // outstanding = 0, so it must drop the outstanding filter entirely.
      if (status === 'LUNAS') {
        q2 = q2.eq('payment_status', 'LUNAS')
      } else if (status === 'DP' || status === 'PELUNASAN') {
        q2 = q2.eq('payment_status', status).gt('outstanding', 0)
      } else {
        q2 = q2.gt('outstanding', 0)
      }

      if (branchId) q2 = q2.eq('branch_id', branchId)
      if (dateFrom) q2 = q2.gte('transaction_date', dateFrom)
      if (dateTo)   q2 = q2.lte('transaction_date', dateTo)

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

  const totalOutstanding = (aggRows ?? []).reduce((s, r) => s + Number(r.outstanding ?? 0), 0)
  const totalCount       = (aggRows ?? []).length

  // ── Batch lookups for the current page (patients, visits, therapists in parallel)
  const patientIds = [...new Set((txnRows ?? []).map((r) => r.patient_id).filter(Boolean))]
  const visitIds   = [...new Set((txnRows ?? []).map((r) => r.visit_id).filter(Boolean))]
  const [{ data: patients }, { data: visitRows }, therapistMap] = await Promise.all([
    patientIds.length > 0
      ? supabase.from('patients').select('id, encrypted_name, encrypted_phone').in('id', patientIds)
      : Promise.resolve({ data: [] as { id: string; encrypted_name: string | null; encrypted_phone: string | null }[] }),
    visitIds.length > 0
      ? supabase.from('patient_visits').select('id, visit_date, service_type').in('id', visitIds)
      : Promise.resolve({ data: [] as { id: string; visit_date: string; service_type: string | null }[] }),
    resolveTherapistNames(supabase, txnRows ?? []),
  ])

  const nameMap = new Map<string, string>()
  for (const p of patients ?? []) {
    try {
      const dec = decryptPatientPII({ encrypted_name: p.encrypted_name ?? '', encrypted_phone: p.encrypted_phone ?? '' })
      nameMap.set(p.id, dec.name || 'Pasien')
    } catch { nameMap.set(p.id, 'Pasien') }
  }

  const visitLabelMap = new Map<string, string>()
  for (const v of visitRows ?? []) {
    const dateLabel = new Date(v.visit_date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    visitLabelMap.set(v.id, `${dateLabel} · ${v.service_type ?? '—'}`)
  }

  const txns = (txnRows ?? []).map((r) => ({
    ...r,
    patient_name: r.patient_id ? (nameMap.get(r.patient_id) ?? 'Pasien') : null,
    branch_name:  ((r.branches as unknown as { name: string } | null))?.name ?? '—',
    visitLabel:   r.visit_id ? (visitLabelMap.get(r.visit_id) ?? null) : null,
    therapist: therapistMap.get(r.id) ?? null,
  }))

  const totalPages = Math.max(1, Math.ceil((txnTotal ?? 0) / PAGE_SIZE))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Wallet size={20} className="text-primary" />
            <h1 className="text-xl font-bold text-foreground">Piutang / DP</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pembayaran yang belum lunas — down payment atau cicilan yang masih berjalan
          </p>
        </div>
        {isDirector && (
          <Suspense>
            <OutstandingBranchFilter branches={branchList ?? []} branchId={branchId} />
          </Suspense>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Total Piutang</p>
          <p className="text-2xl font-bold text-[#FFB35C]">{formatRp(totalOutstanding)}</p>
          <p className="text-xs text-muted-foreground mt-1">Belum dilunasi{dateFrom || dateTo ? ' · rentang dipilih' : ''}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Jumlah Transaksi</p>
          <p className="text-2xl font-bold text-foreground">{totalCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Transaksi belum lunas</p>
        </div>
      </div>

      {/* List */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {txnTotal ?? 0}{q ? ` untuk "${q}"` : ''}
            </span>
            <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/5 border border-white/10">
              {STATUS_TABS.map((tab) => (
                <Link
                  key={tab.value || 'all'}
                  href={buildUrl(baseParams, { status: tab.value || undefined, page: undefined })}
                  className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${
                    status === tab.value
                      ? 'bg-primary text-white shadow'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Suspense>
              <UrlDateRangeFilter from={dateFrom} to={dateTo} />
            </Suspense>
            <Suspense>
              <SearchInput defaultValue={q} />
            </Suspense>
          </div>
        </div>

        {txns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2">
            <AlertCircle size={28} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {q ? `Tidak ada hasil untuk "${q}"` : 'Tidak ada data untuk filter ini'}
            </p>
            {q && (
              <Link href={buildUrl(baseParams, { q: undefined, page: undefined })} className="text-xs text-primary hover:underline mt-1">
                Hapus pencarian
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tanggal</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pasien</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kategori</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Terapis</th>
                    {!branchId && (
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cabang</th>
                    )}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kunjungan</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Harga</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dibayar</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sisa</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {txns.map((tx) => {
                    const editTx: TransactionForEdit = {
                      id:               tx.id,
                      type:             'income',
                      category:         tx.category,
                      harga:            tx.harga as number | null,
                      discount:         tx.discount as number | null,
                      amount:           tx.amount as number | null,
                      payment_method:   tx.payment_method as string | null,
                      payment_status:   tx.payment_status as string | null,
                      penjamin:         tx.penjamin as string | null,
                      description:      tx.description as string | null,
                      transaction_date: tx.transaction_date,
                      patient_id:       tx.patient_id as string | null,
                      patient_name:     tx.patient_name,
                      receipt_url:      tx.receipt_url as string | null,
                    }
                    return (
                      <OutstandingRow
                        key={tx.id}
                        tx={tx}
                        showBranchColumn={!branchId}
                        therapistRange={{ from: dateFrom, to: dateTo }}
                        editTx={editTx}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-white/10">
                <p className="text-xs text-muted-foreground">
                  Halaman {page} dari {totalPages} · {txnTotal} transaksi
                </p>
                <div className="flex items-center gap-1">
                  {page > 1 ? (
                    <Link href={buildUrl(baseParams, { page: String(page - 1) })} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 hover:bg-white/8 transition-colors">
                      <ChevronLeft size={13} /> Sebelumnya
                    </Link>
                  ) : (
                    <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-muted-foreground/40 cursor-not-allowed">
                      <ChevronLeft size={13} /> Sebelumnya
                    </span>
                  )}
                  <div className="flex items-center gap-0.5 mx-1">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 7) {
                        pageNum = i + 1
                      } else if (page <= 4) {
                        pageNum = i < 6 ? i + 1 : totalPages
                      } else if (page >= totalPages - 3) {
                        pageNum = i === 0 ? 1 : totalPages - 6 + i
                      } else {
                        pageNum = i === 0 ? 1 : i === 6 ? totalPages : page - 3 + i
                      }
                      const isEllipsis = totalPages > 7 && ((i === 1 && pageNum !== 2) || (i === 5 && pageNum !== totalPages - 1))
                      if (isEllipsis) {
                        return <span key={i} className="px-1 text-xs text-muted-foreground/50">…</span>
                      }
                      return (
                        <Link
                          key={i}
                          href={buildUrl(baseParams, { page: String(pageNum) })}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                            pageNum === page ? 'bg-primary text-primary-foreground' : 'hover:bg-white/8 text-foreground/70'
                          }`}
                        >
                          {pageNum}
                        </Link>
                      )
                    })}
                  </div>
                  {page < totalPages ? (
                    <Link href={buildUrl(baseParams, { page: String(page + 1) })} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 hover:bg-white/8 transition-colors">
                      Berikutnya <ChevronRight size={13} />
                    </Link>
                  ) : (
                    <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-muted-foreground/40 cursor-not-allowed">
                      Berikutnya <ChevronRight size={13} />
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
