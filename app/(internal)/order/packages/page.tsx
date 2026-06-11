'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/internal'
import { PackagesStats } from '@/components/orders/PackagesStats'
import { PackagesTable } from '@/components/orders/PackagesTable'
import { fetchPackageOrders } from '@/app/actions/orderPackages'
import type { PackageOrderRow, PackageStats } from '@/components/orders/types'
import { Select } from '@/components/orders/Select'

const PAGE_SIZE = 10

const STATUS_OPTIONS = [
  { value: 'in_progress', label: 'Aktif (Proses)' },
  { value: 'all',         label: 'Semua Status' },
  { value: 'completed',   label: 'Selesai' },
  { value: 'cancelled',   label: 'Batal' },
]

const EMPTY_STATS: PackageStats = {
  activePackages: 0, overdueCount: 0, completedThisMonth: 0,
}

export default function OrderPackagesPage() {
  const [rows,         setRows]         = useState<PackageOrderRow[]>([])
  const [total,        setTotal]        = useState(0)
  const [stats,        setStats]        = useState<PackageStats>(EMPTY_STATS)
  const [loading,      setLoading]      = useState(true)
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('in_progress')

  const load = useCallback(async (currentPage: number) => {
    setLoading(true)
    const result = await fetchPackageOrders({
      search,
      page:         currentPage,
      pageSize:     PAGE_SIZE,
      statusFilter,
    })
    setRows(result.data)
    setTotal(result.count)
    setStats(result.stats)
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => {
    setPage(1)
    load(1)
  }, [load])

  function handlePage(p: number) {
    setPage(p)
    load(p)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const fromIdx    = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const toIdx      = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="space-y-5">
      <PageHeader title="By Paket View" breadcrumb="Order" />

      <PackagesStats stats={stats} loading={loading} />

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama pasien atau kode..."
              className="w-full pl-9 pr-3 py-2 border border-border rounded-xl text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            />
          </div>

          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
          />

          <button
            onClick={() => load(page)}
            className="p-2 border border-border rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <PackagesTable
        rows={rows}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        fromIdx={fromIdx}
        toIdx={toIdx}
        onPage={handlePage}
      />
    </div>
  )
}
