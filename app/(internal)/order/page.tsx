'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/internal'
import { OrdersStats } from '@/components/orders/OrdersStats'
import { OrdersFilters } from '@/components/orders/OrdersFilters'
import { OrdersTable } from '@/components/orders/OrdersTable'
import { useOrdersData } from '@/components/orders/useOrdersData'
import { useTranslation } from '@/hooks/useTranslation'

export default function OrderPage() {
  const { t } = useTranslation()

  const [search,        setSearch]        = useState('')
  const [statusFilter,  setStatusFilter]  = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [month,         setMonth]         = useState('')
  const [year,          setYear]          = useState(String(new Date().getFullYear()))

  const {
    rows, total, stats, loading, statsLoading,
    page, totalPages, fromIdx, toIdx,
    handlePage, refresh,
  } = useOrdersData(search, statusFilter, paymentFilter, month, year)

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('page.order.list_title')}
        breadcrumb={t('nav.order')}
        actions={
          <Link
            href="/order/new"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={15} /> {t('page.order.add_title')}
          </Link>
        }
      />

      <OrdersStats stats={stats} statsLoading={statsLoading} />

      <OrdersFilters
        search={search}              setSearch={setSearch}
        statusFilter={statusFilter}  setStatusFilter={setStatusFilter}
        paymentFilter={paymentFilter} setPaymentFilter={setPaymentFilter}
        month={month}                setMonth={setMonth}
        year={year}                  setYear={setYear}
        loading={loading}            onRefresh={refresh}
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
    </div>
  )
}
