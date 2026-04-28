'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { useProfile } from '@/hooks/useProfile'
import { PageHeader, StatusBadge, OrderDetailPanel } from '@/components/internal'
import { formatCurrency, formatDate } from '@/lib/utils'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BookingRow = any

const PAGE_SIZE = 10

const STATUS_OPTIONS = [
  { value: '',                    label: 'Semua' },
  { value: 'waiting_confirmation',label: 'Booking' },
  { value: 'confirmed',           label: 'Confirmed' },
  { value: 'in_progress',         label: 'Proses' },
  { value: 'completed',           label: 'Selesai' },
  { value: 'cancelled',           label: 'Batal' },
]

function getPatientName(row: BookingRow) {
  return row.guest_name ?? row.patients?.encrypted_name ?? '—'
}

function getTherapistName(row: BookingRow) {
  return row.therapists?.profiles?.full_name ?? '—'
}

function getTrxCode(row: BookingRow) {
  return row.internal_order_meta?.[0]?.kode_transaksi ?? '—'
}

function getPaymentStatus(row: BookingRow): 'Belum Lunas' | 'Lunas' {
  return row.internal_order_meta?.[0]?.status_bayar ?? 'Belum Lunas'
}

export default function OrderPage() {
  const { t } = useTranslation()
  const profile = useProfile()

  const [data, setData]               = useState<BookingRow[]>([])
  const [total, setTotal]             = useState(0)
  const [loading, setLoading]         = useState(true)
  const [page, setPage]               = useState(1)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected]       = useState<BookingRow | null>(null)

  const showAmounts = (profile?.role as string) !== 'therapist'

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const from = (page - 1) * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('bookings')
      .select(`
        id, service_type, scheduled_date, scheduled_time, status,
        estimated_price, discounted_price, discount_percentage,
        payment_method, guest_name, guest_phone, admin_notes, created_at,
        patients ( encrypted_name, encrypted_phone ),
        therapists ( profiles ( full_name ) ),
        internal_order_meta ( id, kode_transaksi, status_bayar, catatan_admin )
      `, { count: 'exact' })
      .order('scheduled_date', { ascending: false })
      .range(from, to)

    if (statusFilter) query = query.eq('status', statusFilter)
    if (search.trim()) {
      query = query.or(`guest_name.ilike.%${search}%,service_type.ilike.%${search}%`)
    }

    const { data: rows, count } = await query
    setData((rows ?? []) as BookingRow[])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, search, statusFilter])

  useEffect(() => { loadData() }, [loadData])

  async function handleMarkPaid(row: BookingRow) {
    const supabase = createClient()
    const meta = row.internal_order_meta?.[0]
    if (meta) {
      await supabase.from('internal_order_meta').update({ status_bayar: 'Lunas' }).eq('id', meta.id)
    } else {
      await supabase.from('internal_order_meta').insert({
        booking_id: row.id,
        kode_transaksi: '',
        status_bayar: 'Lunas',
      })
    }
    setSelected(null)
    loadData()
  }

  async function handleStop(row: BookingRow) {
    if (!confirm(t('actions.confirm_stop'))) return
    await createClient().from('bookings').update({ status: 'cancelled' }).eq('id', row.id)
    setSelected(null)
    loadData()
  }

  async function handleAttend(row: BookingRow) {
    if (!confirm(t('actions.confirm_attend'))) return
    const nextStatus = row.status === 'confirmed' ? 'in_progress' : 'completed'
    await createClient().from('bookings').update({ status: nextStatus }).eq('id', row.id)
    setSelected(null)
    loadData()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const fromIdx    = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const toIdx      = Math.min(page * PAGE_SIZE, total)

  return (
    <div>
      <PageHeader title={t('page.order.list_title')} breadcrumb={t('nav.order')} />

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder={t('common.search')}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4A017]"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={loadData}
          className="p-2 border border-gray-200 rounded-xl hover:bg-white transition-colors bg-white text-gray-500"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-10">No.</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('col.kode_transaksi')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('col.patient_name')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('col.physio')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('col.service_name')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{t('col.schedule_date')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('col.status')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('col.payment_status')}</th>
                {showAmounts && (
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">{t('col.total')}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={showAmounts ? 9 : 8} className="px-4 py-14 text-center text-gray-400">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={showAmounts ? 9 : 8} className="px-4 py-14 text-center text-gray-400">
                    {t('common.no_data')}
                  </td>
                </tr>
              ) : (
                data.map((row, i) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelected(row)}
                    className="border-b border-gray-50 hover:bg-amber-50/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-400 text-xs">{fromIdx + i}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded">
                        {getTrxCode(row)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{getPatientName(row)}</td>
                    <td className="px-4 py-3 text-gray-600">{getTherapistName(row)}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{row.service_type}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                      {formatDate(row.scheduled_date)}<br />
                      <span className="text-gray-400">{row.scheduled_time}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge value={row.status} /></td>
                    <td className="px-4 py-3"><StatusBadge value={getPaymentStatus(row)} /></td>
                    {showAmounts && (
                      <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                        {formatCurrency(row.discounted_price ?? row.estimated_price ?? 0)}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
          <span>
            {t('common.showing')} {fromIdx}–{toIdx} {t('common.of')} {total} {t('common.data')}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >‹</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-2 py-1 rounded-lg border transition-colors ${
                  p === page ? 'border-[#D4A017] bg-[#D4A017] text-white' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >{p}</button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >›</button>
          </div>
        </div>
      </div>

      <OrderDetailPanel
        booking={selected}
        onClose={() => setSelected(null)}
        showAmounts={showAmounts}
        onMarkPaid={handleMarkPaid}
        onStop={handleStop}
        onAttend={handleAttend}
      />
    </div>
  )
}
