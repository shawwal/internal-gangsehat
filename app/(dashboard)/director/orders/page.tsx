'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Search, RefreshCw, ClipboardList, Clock, CheckCircle,
  XCircle, Loader, CreditCard, BadgeCheck, ExternalLink,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from '@/components/internal/StatusBadge'
import { formatCurrency, formatDate } from '@/lib/utils'

/* ─── types ───────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrderRow = any

interface Stats {
  total: number
  booking: number
  confirmed: number
  inProgress: number
  completed: number
  cancelled: number
  belumLunas: number
  lunas: number
}

/* ─── constants ───────────────────────────────────────────────── */
const PAGE_SIZE = 15

const MONTHS = [
  { value: '', label: 'Semua Bulan' },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2024, i, 1).toLocaleDateString('id-ID', { month: 'long' }),
  })),
]

const YEARS = Array.from({ length: 4 }, (_, i) => {
  const y = new Date().getFullYear() - i
  return { value: String(y), label: String(y) }
})

const STATUS_OPTIONS = [
  { value: '',                     label: 'Semua Status' },
  { value: 'waiting_confirmation', label: 'Booking' },
  { value: 'confirmed',            label: 'Confirmed' },
  { value: 'in_progress',          label: 'In Progress' },
  { value: 'completed',            label: 'Selesai' },
  { value: 'cancelled',            label: 'Batal' },
]

const PAYMENT_OPTIONS = [
  { value: '',            label: 'Semua Pembayaran' },
  { value: 'Belum Lunas', label: 'Belum Lunas' },
  { value: 'Lunas',       label: 'Lunas' },
]

/* ─── stat card ───────────────────────────────────────────────── */
function StatCard({
  label, value, icon: Icon, color,
}: {
  label: string
  value: number
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="glass-card p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-xl font-bold text-foreground leading-tight">{value.toLocaleString('id-ID')}</p>
      </div>
    </div>
  )
}

/* ─── select ─────────────────────────────────────────────────── */
function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer transition-colors hover:border-primary/50"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

/* ─── helpers ────────────────────────────────────────────────── */
function getPatientName(row: OrderRow): string {
  return row.guest_name ?? row.patients?.encrypted_name ?? '—'
}

function getTrxCode(row: OrderRow): string {
  return row.internal_order_meta?.[0]?.kode_transaksi ?? '—'
}

function getPaymentStatus(row: OrderRow): string {
  return row.internal_order_meta?.[0]?.status_bayar ?? 'Belum Lunas'
}

function getTherapistName(row: OrderRow): string {
  return row.therapists?.profiles?.full_name ?? '—'
}

/* ─── page ───────────────────────────────────────────────────── */
export default function DirectorOrdersPage() {
  const [rows, setRows]           = useState<OrderRow[]>([])
  const [total, setTotal]         = useState(0)
  const [stats, setStats]         = useState<Stats>({ total: 0, booking: 0, confirmed: 0, inProgress: 0, completed: 0, cancelled: 0, belumLunas: 0, lunas: 0 })
  const [loading, setLoading]     = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [page, setPage]           = useState(1)

  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [month, setMonth]               = useState('')
  const [year, setYear]                 = useState(String(new Date().getFullYear()))

  const todayLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  /* ─── resolve payment-filtered booking IDs ─────────── */
  async function resolvePaymentIds(supabase: ReturnType<typeof createClient>, filter: string) {
    if (!filter) return null
    const { data } = await supabase
      .from('internal_order_meta')
      .select('booking_id')
      .eq('status_bayar', filter)
    return (data ?? []).map((m: { booking_id: string }) => m.booking_id)
  }

  /* ─── date range helpers ───────────────────────────── */
  function applyDateFilter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    q: any,
    m: string,
    y: string,
    col = 'scheduled_date',
  ) {
    if (m && y) {
      const mm  = m.padStart(2, '0')
      const nm  = String(Number(m) % 12 + 1).padStart(2, '0')
      const ny  = Number(m) === 12 ? Number(y) + 1 : y
      q = q.gte(col, `${y}-${mm}-01`).lt(col, `${ny}-${nm}-01`)
    } else if (y) {
      q = q.gte(col, `${y}-01-01`).lt(col, `${Number(y) + 1}-01-01`)
    }
    return q
  }

  /* ─── load stats ───────────────────────────────────── */
  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    const supabase = createClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function base(status?: string): any {
      let q = supabase.from('bookings').select('id', { count: 'exact', head: true })
      if (status) q = q.eq('status', status)
      q = applyDateFilter(q, month, year)
      return q
    }

    const [totalR, bookingR, confirmedR, inProgR, completedR, cancelledR] = await Promise.all([
      base(), base('waiting_confirmation'), base('confirmed'),
      base('in_progress'), base('completed'), base('cancelled'),
    ])

    // Payment stats (from internal_order_meta)
    const { count: belumLunasCount } = await supabase
      .from('internal_order_meta')
      .select('id', { count: 'exact', head: true })
      .eq('status_bayar', 'Belum Lunas')

    const { count: lunasCount } = await supabase
      .from('internal_order_meta')
      .select('id', { count: 'exact', head: true })
      .eq('status_bayar', 'Lunas')

    setStats({
      total:      totalR.count     ?? 0,
      booking:    bookingR.count   ?? 0,
      confirmed:  confirmedR.count ?? 0,
      inProgress: inProgR.count    ?? 0,
      completed:  completedR.count ?? 0,
      cancelled:  cancelledR.count ?? 0,
      belumLunas: belumLunasCount  ?? 0,
      lunas:      lunasCount       ?? 0,
    })
    setStatsLoading(false)
  }, [month, year])

  /* ─── load rows ────────────────────────────────────── */
  const loadRows = useCallback(async (currentPage: number) => {
    setLoading(true)
    const supabase = createClient()
    const from = (currentPage - 1) * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    // Resolve payment filter to booking IDs
    const paymentIds = await resolvePaymentIds(supabase, paymentFilter)
    if (paymentIds !== null && paymentIds.length === 0) {
      setRows([]); setTotal(0); setLoading(false); return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from('bookings')
      .select(`
        id, service_type, scheduled_date, scheduled_time, status,
        estimated_price, discounted_price, discount_percentage,
        guest_name, guest_phone, created_at,
        patients ( encrypted_name ),
        therapists ( profiles ( full_name ) ),
        internal_order_meta ( kode_transaksi, status_bayar )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (statusFilter)       q = q.eq('status', statusFilter)
    if (paymentIds !== null) q = q.in('id', paymentIds)
    if (search.trim())      q = q.or(`guest_name.ilike.%${search.trim()}%,service_type.ilike.%${search.trim()}%`)
    q = applyDateFilter(q, month, year)

    const { data, count } = await q
    setRows((data ?? []) as OrderRow[])
    setTotal(count ?? 0)
    setLoading(false)
  }, [search, statusFilter, paymentFilter, month, year])

  /* ─── effects ──────────────────────────────────────── */
  useEffect(() => {
    setPage(1)
    loadStats()
    loadRows(1)
  }, [search, statusFilter, paymentFilter, month, year, loadStats, loadRows])

  function handlePage(p: number) {
    setPage(p)
    loadRows(p)
  }

  /* ─── pagination ───────────────────────────────────── */
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const fromIdx    = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const toIdx      = Math.min(page * PAGE_SIZE, total)

  /* ─── render ───────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Semua Order</h1>
          <p className="text-sm text-muted-foreground">Pantau seluruh order dari semua cabang</p>
        </div>
        <span className="text-xs bg-muted px-3 py-1.5 rounded-2xl text-muted-foreground shrink-0 hidden sm:block">
          {todayLabel}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        <StatCard label="Total Order" value={statsLoading ? 0 : stats.total}      icon={ClipboardList} color="bg-primary/10 text-primary" />
        <StatCard label="Booking"     value={statsLoading ? 0 : stats.booking}    icon={Clock}         color="bg-blue-500/10 text-blue-500" />
        <StatCard label="Confirmed"   value={statsLoading ? 0 : stats.confirmed}  icon={CheckCircle}   color="bg-yellow-500/10 text-yellow-500" />
        <StatCard label="In Progress" value={statsLoading ? 0 : stats.inProgress} icon={Loader}        color="bg-orange-500/10 text-orange-500" />
        <StatCard label="Selesai"     value={statsLoading ? 0 : stats.completed}  icon={BadgeCheck}    color="bg-green-500/10 text-green-500" />
        <StatCard label="Batal"       value={statsLoading ? 0 : stats.cancelled}  icon={XCircle}       color="bg-destructive/10 text-destructive" />
        <StatCard label="Belum Lunas" value={statsLoading ? 0 : stats.belumLunas} icon={CreditCard}    color="bg-orange-500/10 text-orange-500" />
        <StatCard label="Lunas"       value={statsLoading ? 0 : stats.lunas}      icon={CheckCircle}   color="bg-green-500/10 text-green-500" />
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari pasien atau layanan..."
              className="w-full pl-9 pr-3 py-2 border border-border rounded-xl text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            />
          </div>

          <Select value={statusFilter}  onChange={setStatusFilter}  options={STATUS_OPTIONS} />
          <Select value={paymentFilter} onChange={setPaymentFilter} options={PAYMENT_OPTIONS} />
          <Select value={month}         onChange={setMonth}         options={MONTHS} />
          <Select value={year}          onChange={setYear}          options={[{ value: '', label: 'Semua Tahun' }, ...YEARS]} />

          <button
            onClick={() => { loadStats(); loadRows(page) }}
            className="p-2 border border-border rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label="Refresh data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-10">No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kode</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pasien</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Layanan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fisio</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Jadwal</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bayar</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded-lg" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <ClipboardList size={22} className="text-primary" />
                      </div>
                      <p className="text-sm font-medium text-foreground">Tidak ada order ditemukan</p>
                      <p className="text-xs text-muted-foreground">Coba ubah filter atau kata kunci pencarian</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => {
                  const trx     = getTrxCode(row)
                  const payment = getPaymentStatus(row)
                  const total   = row.discounted_price ?? row.estimated_price ?? 0

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border/50 hover:bg-primary/5 transition-colors"
                    >
                      <td className="px-4 py-3 text-muted-foreground text-xs">{fromIdx + i}</td>

                      <td className="px-4 py-3">
                        <Link
                          href={`/order/${row.id}`}
                          className="font-mono text-xs font-medium text-primary hover:underline decoration-primary/50 underline-offset-2 transition-colors cursor-pointer"
                        >
                          {trx}
                        </Link>
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground leading-tight">{getPatientName(row)}</p>
                      </td>

                      <td className="px-4 py-3">
                        <p className="text-foreground/80 max-w-[140px] truncate text-xs">{row.service_type}</p>
                      </td>

                      <td className="px-4 py-3">
                        <p className="text-foreground/70 text-xs truncate max-w-[120px]">{getTherapistName(row)}</p>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-xs text-foreground/80">{formatDate(row.scheduled_date)}</p>
                        <p className="text-[10px] text-muted-foreground">{row.scheduled_time}</p>
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge value={row.status} />
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge value={payment} />
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-foreground text-xs whitespace-nowrap">
                          {total > 0 ? formatCurrency(total) : '—'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/order/${row.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                          aria-label={`Lihat detail order ${trx}`}
                        >
                          <ExternalLink size={12} />
                          Detail
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
            <span>
              Menampilkan {fromIdx}–{toIdx} dari {total.toLocaleString('id-ID')} order
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-2.5 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors cursor-pointer"
              >
                ‹
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = totalPages <= 7
                  ? i + 1
                  : page <= 4
                  ? i + 1
                  : page >= totalPages - 3
                  ? totalPages - 6 + i
                  : page - 3 + i
                return (
                  <button
                    key={p}
                    onClick={() => handlePage(p)}
                    className={`px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                      p === page
                        ? 'border-primary bg-primary text-primary-foreground font-medium'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => handlePage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors cursor-pointer"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
