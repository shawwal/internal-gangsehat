'use client'

import { useState } from 'react'
import { PageHeader, OrderDetailPanel } from '@/components/internal'
import { OrdersStats } from '@/components/orders/OrdersStats'
import { OrdersFilters } from '@/components/orders/OrdersFilters'
import { OrdersTable } from '@/components/orders/OrdersTable'
import { useOrdersData } from '@/components/orders/useOrdersData'
import { useProfile } from '@/hooks/useProfile'
import { useTranslation } from '@/hooks/useTranslation'
import { createClient } from '@/lib/supabase/client'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BookingRow = any

export default function OrderPage() {
  const { t }   = useTranslation()
  const profile = useProfile()

  const [search,        setSearch]        = useState('')
  const [statusFilter,  setStatusFilter]  = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [month,         setMonth]         = useState('')
  const [year,          setYear]          = useState(String(new Date().getFullYear()))

  const [selected, setSelected] = useState<BookingRow | null>(null)

  const {
    rows, total, stats, loading, statsLoading,
    page, totalPages, fromIdx, toIdx,
    handlePage, refresh,
  } = useOrdersData(search, statusFilter, paymentFilter, month, year)

  const showAmounts = (profile?.role as string) !== 'therapist'

  async function handleMarkPaid(row: BookingRow) {
    const supabase = createClient()
    const meta = row.internal_order_meta?.[0]
    if (meta) {
      await supabase.from('internal_order_meta').update({ status_bayar: 'Lunas' }).eq('id', meta.id)
    } else {
      await supabase.from('internal_order_meta').insert({
        booking_id: row.id, kode_transaksi: '', status_bayar: 'Lunas',
      })
    }
    setSelected(null)
    refresh()
  }

  async function handleStop(row: BookingRow) {
    if (!confirm(t('actions.confirm_stop'))) return
    await createClient().from('bookings').update({ status: 'cancelled' }).eq('id', row.id)
    setSelected(null)
    refresh()
  }

  async function handleAttend(row: BookingRow) {
    if (!confirm(t('actions.confirm_attend'))) return
    const nextStatus = row.status === 'confirmed' ? 'in_progress' : 'completed'
    await createClient().from('bookings').update({ status: nextStatus }).eq('id', row.id)
    setSelected(null)
    refresh()
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t('page.order.list_title')} breadcrumb={t('nav.order')} />

      <OrdersStats stats={stats} statsLoading={statsLoading} />

      <OrdersFilters
        search={search}           setSearch={(v) => { setSearch(v) }}
        statusFilter={statusFilter}  setStatusFilter={setStatusFilter}
        paymentFilter={paymentFilter} setPaymentFilter={setPaymentFilter}
        month={month}             setMonth={setMonth}
        year={year}               setYear={setYear}
        loading={loading}         onRefresh={refresh}
      />

      <OrdersTable
        rows={rows}
        loading={loading}
        total={total}
        page={page}
        fromIdx={fromIdx}
        toIdx={toIdx}
        totalPages={totalPages}
        onPage={handlePage}
      />

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
