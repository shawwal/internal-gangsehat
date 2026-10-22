import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { AlertCircle, ArrowLeft, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Receipt, Wallet, Users, Hourglass, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { getTherapistProfile, loadTherapistTransactions } from '@/lib/finance/therapists'
import { UrlDateRangeFilter } from '@/components/finance/DateRangeFilter'
import { UrlSortSelect } from '@/components/finance/UrlSortSelect'
import { SearchInput } from '@/components/director/finance/SearchInput'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20
const ISO_DATE  = /^\d{4}-\d{2}-\d{2}$/
const UUID      = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PAY_STATUS_BADGE: Record<string, string> = {
  LUNAS:     'bg-green-500/15 text-green-400',
  DP:        'bg-yellow-500/15 text-yellow-400',
  PELUNASAN: 'bg-primary/15 text-primary',
}
const TX_STATUS_BADGE: Record<string, string> = {
  pending:   'bg-yellow-500/15 text-yellow-400',
  confirmed: 'bg-green-500/15 text-green-400',
}
const TX_STATUS_LABEL: Record<string, string> = { pending: 'Menunggu', confirmed: 'Dikonfirmasi' }

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Tanggal terbaru' },
  { value: 'date_asc',  label: 'Tanggal terlama' },
  { value: 'name_asc',  label: 'Nama pasien A–Z' },
  { value: 'name_desc', label: 'Nama pasien Z–A' },
] as const
type SortKey = typeof SORT_OPTIONS[number]['value']
const isSortKey = (v: string | undefined): v is SortKey => SORT_OPTIONS.some((o) => o.value === v)

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function formatDay(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function TherapistTransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; to?: string; page?: string; q?: string; sort?: string }>
}) {
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const sp       = await searchParams
  const dateFrom = sp.from && ISO_DATE.test(sp.from) ? sp.from : ''
  const dateTo   = sp.to   && ISO_DATE.test(sp.to)   ? sp.to   : ''
  const q        = sp.q?.trim() ?? ''
  const sort: SortKey = isSortKey(sp.sort) ? sp.sort : 'date_desc'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('internal_profiles').select('role').eq('id', user!.id).single()
  const isDirector = me?.role === 'director'

  const [therapist, allRows] = await Promise.all([
    getTherapistProfile(id),
    loadTherapistTransactions(supabase, id, { from: dateFrom, to: dateTo }),
  ])
  if (!therapist) notFound()

  // ── Patient sort/search keys: plaintext name_normalized, no decryption ────
  const allPatientIds = [...new Set(allRows.map((r) => r.patient_id).filter((x): x is string => !!x))]
  const sortName = new Map<string, string>()
  const ID_CHUNK = 150 // keep the `in (...)` URL short
  const chunks = Array.from({ length: Math.ceil(allPatientIds.length / ID_CHUNK) }, (_, i) =>
    allPatientIds.slice(i * ID_CHUNK, (i + 1) * ID_CHUNK))
  const chunkResults = await Promise.all(chunks.map((ids) =>
    supabase.from('patients').select('id, name_normalized').in('id', ids)))
  for (const { data } of chunkResults) {
    for (const p of data ?? []) sortName.set(p.id, String(p.name_normalized ?? '').toLowerCase())
  }
  const nameKey = (r: { patient_id: string | null }) => (r.patient_id ? sortName.get(r.patient_id) ?? '' : '')

  // ── Search (patient name, category, description) → drives totals + list ───
  const needle = q.toLowerCase()
  const rows = needle
    ? allRows.filter((r) =>
        nameKey(r).includes(needle) ||
        r.category.toLowerCase().includes(needle) ||
        (r.description ?? '').toLowerCase().includes(needle))
    : [...allRows]

  // ── Sort. Name sorts put rows without a patient last. ─────────────────────
  rows.sort((a, b) => {
    if (sort === 'name_asc' || sort === 'name_desc') {
      const na = nameKey(a), nb = nameKey(b)
      if (!na !== !nb) return na ? -1 : 1
      const cmp = na.localeCompare(nb, 'id')
      if (cmp !== 0) return sort === 'name_asc' ? cmp : -cmp
      return b.transaction_date.localeCompare(a.transaction_date)
    }
    const cmp = a.transaction_date.localeCompare(b.transaction_date) || a.id.localeCompare(b.id)
    return sort === 'date_asc' ? cmp : -cmp
  })

  // ── Totals over the whole period (rejected already excluded) ──────────────
  const income      = rows.filter((r) => r.type === 'income')
  const billed      = income.reduce((s, r) => s + Number(r.harga ?? 0) - Number(r.discount ?? 0), 0)
  const collected   = income.reduce((s, r) => s + Number(r.amount ?? 0), 0)
  const outstanding = income.reduce((s, r) => s + Number(r.outstanding ?? 0), 0)
  const patients    = new Set(rows.map((r) => r.patient_id).filter(Boolean)).size

  const byCategory = new Map<string, { count: number; collected: number }>()
  for (const r of income) {
    const c = byCategory.get(r.category) ?? { count: 0, collected: 0 }
    c.count += 1
    c.collected += Number(r.amount ?? 0)
    byCategory.set(r.category, c)
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1].collected - a[1].collected)

  // ── Current page + patient names for it only ──────────────────────────────
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const page       = Math.min(totalPages, Math.max(1, Number(sp.page) || 1))
  const pageRows   = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const patientIds = [...new Set(pageRows.map((r) => r.patient_id).filter((x): x is string => !!x))]
  const nameMap = new Map<string, string>()
  if (patientIds.length > 0) {
    const { data: pts } = await supabase.from('patients').select('id, encrypted_name, encrypted_phone').in('id', patientIds)
    for (const p of pts ?? []) {
      try {
        const dec = decryptPatientPII({ encrypted_name: p.encrypted_name ?? '', encrypted_phone: p.encrypted_phone ?? '' })
        nameMap.set(p.id, dec.name || 'Pasien')
      } catch { nameMap.set(p.id, 'Pasien') }
    }
  }

  const showBranch = isDirector && new Set(rows.map((r) => r.branch_id)).size > 1
  const periodLabel = dateFrom && dateTo ? `${formatDay(dateFrom)} – ${formatDay(dateTo)}`
    : dateFrom ? `Sejak ${formatDay(dateFrom)}`
    : dateTo   ? `Sampai ${formatDay(dateTo)}`
    : 'Semua waktu'

  function buildHref(overrides: { page?: number; sort?: SortKey; q?: string }) {
    const p = new URLSearchParams()
    if (dateFrom) p.set('from', dateFrom)
    if (dateTo)   p.set('to', dateTo)
    const nextQ = overrides.q ?? q
    if (nextQ)    p.set('q', nextQ)
    const nextSort = overrides.sort ?? sort
    if (nextSort !== 'date_desc') p.set('sort', nextSort)
    if (overrides.page && overrides.page > 1) p.set('page', String(overrides.page))
    const qs = p.toString()
    return `/finance/transactions/terapis/${id}${qs ? `?${qs}` : ''}`
  }
  const pageHref = (page: number) => buildHref({ page })

  // Clickable column headers: Tanggal toggles newest/oldest, Pasien A–Z/Z–A
  const dateSorted = sort === 'date_desc' || sort === 'date_asc'
  const nameSorted = sort === 'name_asc' || sort === 'name_desc'
  const dateHeaderHref = buildHref({ sort: sort === 'date_desc' ? 'date_asc' : 'date_desc' })
  const nameHeaderHref = buildHref({ sort: sort === 'name_asc' ? 'name_desc' : 'name_asc' })
  const sortIcon = (active: boolean, asc: boolean) =>
    active ? (asc ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : null

  const backHref = isDirector ? '/director/finance' : '/finance/transactions'

  const kpis = [
    { label: 'Jumlah Transaksi', value: String(rows.length), sub: `${income.length} pemasukan`, icon: <Receipt size={16} className="text-white" />, bg: 'bg-primary' },
    { label: 'Total Dibayar',    value: formatRp(collected),  sub: `dari tagihan ${formatRp(billed)}`, icon: <Wallet size={16} className="text-white" />, bg: 'bg-[#34C759]' },
    { label: 'Piutang',          value: formatRp(outstanding), sub: 'Belum dilunasi', icon: <Hourglass size={16} className="text-white" />, bg: 'bg-[#FFB35C]' },
    { label: 'Pasien',           value: String(patients),     sub: 'Pasien unik', icon: <Users size={16} className="text-white" />, bg: 'bg-muted-foreground' },
  ]

  return (
    <div className="space-y-6 relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href={backHref} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mb-2">
            <ArrowLeft size={13} /> Kembali ke transaksi
          </Link>
          <div className="flex items-center gap-2">
            <UserRound size={20} className="text-primary" />
            <h1 className="text-xl font-bold text-foreground">{therapist.name}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Transaksi terkait terapis{therapist.branchName ? ` · ${therapist.branchName}` : ''} · {periodLabel}
            {q && <> · pencarian &ldquo;{q}&rdquo;</>}
          </p>
        </div>
        <Suspense>
          <UrlDateRangeFilter from={dateFrom} to={dateTo} />
        </Suspense>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="glass-card p-3.5 sm:p-5 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{k.label}</p>
              <div className={`w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-2xl flex items-center justify-center ${k.bg}`}>{k.icon}</div>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-foreground leading-tight break-words">{k.value}</p>
            <p className="text-xs text-muted-foreground mt-1 truncate">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Per category */}
      {categories.length > 0 && (
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Per Kategori</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map(([cat, c]) => (
              <div key={cat} className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-xs font-medium text-foreground">{cat}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.count} transaksi · <span className="text-[#34C759] font-mono">{formatRp(c.collected)}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Daftar Transaksi</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {rows.length}{q ? ` dari ${allRows.length} untuk "${q}"` : ''} · tidak termasuk transaksi ditolak
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Suspense>
              <SearchInput defaultValue={q} />
            </Suspense>
            <Suspense>
              <UrlSortSelect value={sort} options={[...SORT_OPTIONS]} />
            </Suspense>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2">
            <AlertCircle size={28} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {q ? `Tidak ada hasil untuk "${q}"` : 'Tidak ada transaksi untuk periode ini'}
            </p>
            {q && (
              <Link href={buildHref({ q: '' })} className="text-xs text-primary hover:underline mt-1">
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
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <Link href={dateHeaderHref} className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${dateSorted ? 'text-foreground' : ''}`}>
                        Tanggal {sortIcon(dateSorted, sort === 'date_asc')}
                      </Link>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kategori</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <Link href={nameHeaderHref} className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${nameSorted ? 'text-foreground' : ''}`}>
                        Pasien {sortIcon(nameSorted, sort === 'name_asc')}
                      </Link>
                    </th>
                    {showBranch && <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cabang</th>}
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Harga</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bayar</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sisa</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pembayaran</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">{formatDay(r.transaction_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.type === 'income' ? 'bg-[#34C759]' : 'bg-destructive'}`} />
                          <span className="text-xs font-medium text-foreground">{r.category}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {r.patient_id ? (
                          <Link href={`/patients/${r.patient_id}`} className="text-foreground/90 hover:text-primary hover:underline">
                            {nameMap.get(r.patient_id) ?? 'Pasien'}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground truncate block max-w-45">{r.description ?? '—'}</span>
                        )}
                      </td>
                      {showBranch && <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{r.branch_name}</td>}
                      <td className="px-4 py-3 text-right font-mono text-xs text-foreground">{formatRp(Number(r.harga ?? 0))}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[#34C759]">{formatRp(Number(r.amount ?? 0))}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {Number(r.outstanding ?? 0) > 0
                          ? <span className="text-[#FFB35C] font-semibold">{formatRp(Number(r.outstanding))}</span>
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.payment_status
                          ? <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${PAY_STATUS_BADGE[r.payment_status] ?? 'text-muted-foreground'}`}>{r.payment_status}</span>
                          : <span className="text-muted-foreground/40 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${TX_STATUS_BADGE[r.status] ?? 'text-muted-foreground'}`}>
                          {TX_STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-5 py-4 border-t border-white/10">
                <p className="text-xs text-muted-foreground">Halaman {page} dari {totalPages} · {rows.length} transaksi</p>
                <div className="flex items-center gap-1">
                  {page > 1 ? (
                    <Link href={pageHref(page - 1)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 hover:bg-white/8 transition-colors">
                      <ChevronLeft size={13} /> Sebelumnya
                    </Link>
                  ) : (
                    <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-muted-foreground/40 cursor-not-allowed">
                      <ChevronLeft size={13} /> Sebelumnya
                    </span>
                  )}
                  {page < totalPages ? (
                    <Link href={pageHref(page + 1)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 hover:bg-white/8 transition-colors">
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
