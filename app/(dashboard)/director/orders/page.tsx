'use client'

import { useState } from 'react'
import { useOrdersData } from '@/components/orders/useOrdersData'
import { OrdersStats } from '@/components/orders/OrdersStats'
import { OrdersFilters } from '@/components/orders/OrdersFilters'
import { OrdersTable } from '@/components/orders/OrdersTable'

export default function DirectorOrdersPage() {
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [month, setMonth]                 = useState('')
  const [year, setYear]                   = useState(String(new Date().getFullYear()))

  const {
    rows, total, stats, loading, statsLoading,
    page, totalPages, fromIdx, toIdx,
    handlePage, refresh,
  } = useOrdersData(search, statusFilter, paymentFilter, month, year)

  const todayLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

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

      <OrdersStats stats={stats} statsLoading={statsLoading} />

      <OrdersFilters
        search={search}           setSearch={setSearch}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
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
    </div>
  )
}
