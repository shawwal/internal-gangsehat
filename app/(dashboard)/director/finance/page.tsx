import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { BranchFilter } from '@/components/overview/BranchFilter'
import { SearchInput } from '@/components/director/finance/SearchInput'
import { TrendingUp, TrendingDown, Landmark, AlertCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n)
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des']

const TX_STATUS_BADGE: Record<string, string> = {
  pending:   'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-green-500/15 text-green-400 border-green-500/30',
  rejected:  'bg-red-500/15 text-red-400 border-red-500/30',
}
const TX_STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu', confirmed: 'Dikonfirmasi', rejected: 'Ditolak',
}
const PAY_STATUS_BADGE: Record<string, string> = {
  LUNAS:     'bg-green-500/15 text-green-400',
  DP:        'bg-yellow-500/15 text-yellow-400',
  PELUNASAN: 'bg-primary/15 text-primary',
}

interface BranchSummary {
  name: string
  income: number
  collected: number
  expense: number
  outstanding: number
  net: number
}

// Build the URL preserving existing params but changing one key
function buildUrl(base: Record<string, string>, overrides: Record<string, string | undefined>) {
  const p = new URLSearchParams()
  const merged = { ...base, ...overrides }
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== '') p.set(k, v)
  }
  return `/director/finance?${p.toString()}`
}

export default async function DirectorFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; month?: string; year?: string; page?: string; q?: string }>
}) {
  const params   = await searchParams
  const branchId = params.branch ?? ''
  const month    = params.month  ?? ''
  const year     = params.year   ?? String(new Date().getFullYear())
  const q        = params.q?.trim() ?? ''
  const page     = Math.max(1, Number(params.page) || 1)
  const from     = (page - 1) * PAGE_SIZE
  const to       = from + PAGE_SIZE - 1

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

  // Base params for URL building (excludes page so links can override it)
  const baseParams: Record<string, string> = {}
  if (branchId) baseParams.branch = branchId
  if (month)    baseParams.month  = month
  if (year)     baseParams.year   = year
  if (q)        baseParams.q      = q

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

    // All txns for aggregate (no search filter, no pagination)
    (async () => {
      let q2 = supabase
        .from('transactions')
        .select('branch_id, type, harga, discount, amount, outstanding, branches!branch_id(name)')
        .neq('status', 'rejected')
        .gte('transaction_date', dateFrom)
        .lt('transaction_date', dateTo)
      if (branchId) q2 = q2.eq('branch_id', branchId)
      return q2
    })(),

    // Paginated + searchable transactions
    (async () => {
      let q2 = supabase
        .from('transactions')
        .select(
          'id, branch_id, patient_id, type, category, harga, discount, amount, outstanding, payment_status, status, transaction_date, description, penjamin, branches!branch_id(name)',
          { count: 'exact' },
        )
        .neq('status', 'rejected')
        .gte('transaction_date', dateFrom)
        .lt('transaction_date', dateTo)
        .order('transaction_date', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)

      if (branchId) q2 = q2.eq('branch_id', branchId)

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
  const branches    = Object.values(branchMap).sort((a, b) => b.income - a.income)
  const totalIncome      = branches.reduce((s, b) => s + b.income,      0)
  const totalCollected   = branches.reduce((s, b) => s + b.collected,   0)
  const totalExpense     = branches.reduce((s, b) => s + b.expense,     0)
  const totalOutstanding = branches.reduce((s, b) => s + b.outstanding, 0)
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

  const txns = (txnRows ?? []).map(r => ({
    ...r,
    patient_name: r.patient_id ? (nameMap.get(r.patient_id) ?? 'Pasien') : null,
    branch_name:  ((r.branches as unknown as { name: string } | null))?.name ?? '—',
  }))

  const totalPages     = Math.max(1, Math.ceil((txnTotal ?? 0) / PAGE_SIZE))
  const selectedBranch = branchId
    ? ((branchList ?? []).find(b => b.id === branchId)?.name ?? '...')
    : 'Semua Cabang'

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
            {selectedBranch} · {periodLabel}
          </p>
        </div>
        <BranchFilter
          branches={branchList ?? []}
          branchId={branchId}
          month={month}
          year={year}
        />
      </div>

      {/* Aggregate KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Total Tagihan</p>
          <p className="text-2xl font-bold text-foreground">{formatRp(totalIncome)}</p>
          <p className="text-xs text-muted-foreground mt-1">Harga billed ke pasien</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Terkumpul</p>
          <p className="text-2xl font-bold text-[#34C759]">{formatRp(totalCollected)}</p>
          <p className="text-xs text-muted-foreground mt-1">Jumlah bayar diterima</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Outstanding</p>
          <p className="text-2xl font-bold text-[#FFB35C]">{formatRp(totalOutstanding)}</p>
          <p className="text-xs text-muted-foreground mt-1">Belum dilunasi</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {totalNet >= 0 ? 'Laba Bersih' : 'Rugi Bersih'}
            </p>
            {totalNet >= 0
              ? <TrendingUp size={16} className="text-[#34C759]" />
              : <TrendingDown size={16} className="text-destructive" />
            }
          </div>
          <p className={`text-2xl font-bold ${totalNet >= 0 ? 'text-[#34C759]' : 'text-destructive'}`}>
            {formatRp(Math.abs(totalNet))}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Keluar {formatRp(totalExpense)}</p>
        </div>
      </div>

      {/* Per-branch summary table */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-foreground">Ringkasan Per Cabang</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{periodLabel} · tidak termasuk transaksi ditolak</p>
        </div>
        {branches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <AlertCircle size={28} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Belum ada transaksi untuk periode ini</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cabang</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tagihan</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Terkumpul</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outstanding</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pengeluaran</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Laba / Rugi</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-foreground">{b.name}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-sm text-foreground">{formatRp(b.income)}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-sm text-[#34C759]">{formatRp(b.collected)}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-sm text-[#FFB35C]">
                      {b.outstanding > 0 ? formatRp(b.outstanding) : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-sm text-destructive">
                      {b.expense > 0 ? formatRp(b.expense) : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`font-mono text-sm font-semibold ${b.net >= 0 ? 'text-[#34C759]' : 'text-destructive'}`}>
                        {b.net >= 0 ? '+' : '-'}{formatRp(Math.abs(b.net))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/15 bg-white/5">
                  <td className="px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">Total</td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-bold text-foreground">{formatRp(totalIncome)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-bold text-[#34C759]">{formatRp(totalCollected)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-bold text-[#FFB35C]">{formatRp(totalOutstanding)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-bold text-destructive">{formatRp(totalExpense)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-mono text-sm font-bold ${totalNet >= 0 ? 'text-[#34C759]' : 'text-destructive'}`}>
                      {totalNet >= 0 ? '+' : '-'}{formatRp(Math.abs(totalNet))}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Transactions section: search + table + pagination */}
      <div className="glass-card overflow-hidden">
        {/* Header + search bar */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Transaksi</h2>
            <span className="text-xs text-muted-foreground">
              {txnTotal ?? 0} transaksi{q ? ` untuk "${q}"` : ''}
            </span>
          </div>
          <Suspense>
            <SearchInput defaultValue={q} />
          </Suspense>
        </div>

        {txns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2">
            <AlertCircle size={28} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {q ? `Tidak ada transaksi untuk "${q}"` : 'Belum ada transaksi untuk periode ini'}
            </p>
            {q && (
              <Link
                href={buildUrl(baseParams, { q: undefined, page: undefined })}
                className="text-xs text-primary hover:underline mt-1"
              >
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kategori</th>
                    {!branchId && (
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cabang</th>
                    )}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pasien / Keterangan</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Harga</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bayar</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pembayaran</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((tx) => (
                    <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {new Date(tx.transaction_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tx.type === 'income' ? 'bg-[#34C759]' : 'bg-destructive'}`} />
                          <span className="text-xs font-medium text-foreground">{tx.category}</span>
                        </div>
                      </td>
                      {!branchId && (
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{tx.branch_name}</td>
                      )}
                      <td className="px-4 py-3 max-w-[180px]">
                        {tx.patient_name ? (
                          <span className="text-xs text-foreground/90">{tx.patient_name}</span>
                        ) : tx.description ? (
                          <span className="text-xs text-muted-foreground truncate block">{tx.description}</span>
                        ) : tx.penjamin ? (
                          <span className="text-xs text-muted-foreground/60">{tx.penjamin}</span>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-foreground">
                        {formatRp(Number(tx.harga ?? 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[#34C759]">
                        {formatRp(Number(tx.amount ?? 0))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${TX_STATUS_BADGE[tx.status] ?? ''}`}>
                          {TX_STATUS_LABEL[tx.status] ?? tx.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {tx.payment_status ? (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${PAY_STATUS_BADGE[tx.payment_status] ?? 'text-muted-foreground'}`}>
                            {tx.payment_status}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-white/10">
                <p className="text-xs text-muted-foreground">
                  Halaman {page} dari {totalPages} · {txnTotal} transaksi
                </p>
                <div className="flex items-center gap-1">
                  {/* Prev */}
                  {page > 1 ? (
                    <Link
                      href={buildUrl(baseParams, { page: String(page - 1) })}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 hover:bg-white/8 transition-colors"
                    >
                      <ChevronLeft size={13} /> Sebelumnya
                    </Link>
                  ) : (
                    <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-muted-foreground/40 cursor-not-allowed">
                      <ChevronLeft size={13} /> Sebelumnya
                    </span>
                  )}

                  {/* Page numbers */}
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
                      const isEllipsis =
                        totalPages > 7 &&
                        ((i === 1 && pageNum !== 2) || (i === 5 && pageNum !== totalPages - 1))
                      if (isEllipsis) {
                        return <span key={i} className="px-1 text-xs text-muted-foreground/50">…</span>
                      }
                      return (
                        <Link
                          key={i}
                          href={buildUrl(baseParams, { page: String(pageNum) })}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                            pageNum === page
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-white/8 text-foreground/70'
                          }`}
                        >
                          {pageNum}
                        </Link>
                      )
                    })}
                  </div>

                  {/* Next */}
                  {page < totalPages ? (
                    <Link
                      href={buildUrl(baseParams, { page: String(page + 1) })}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 hover:bg-white/8 transition-colors"
                    >
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
