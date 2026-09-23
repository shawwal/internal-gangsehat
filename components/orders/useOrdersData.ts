'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchOrdersList, fetchOrdersStats } from '@/app/actions/orders'
import { PAGE_SIZE } from './constants'
import type { OrderRow, Stats } from './types'

const EMPTY_STATS: Stats = {
  total: 0, booking: 0, confirmed: 0, inProgress: 0,
  completed: 0, cancelled: 0, belumLunas: 0, lunas: 0,
}

export function useOrdersData(
  search: string,
  statusFilter: string,
  paymentFilter: string,
  month: string,
  year: string,
) {
  const [rows, setRows]           = useState<OrderRow[]>([])
  const [total, setTotal]         = useState(0)
  const [stats, setStats]         = useState<Stats>(EMPTY_STATS)
  const [loading, setLoading]     = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [page, setPage]           = useState(1)
  // 'all' until the first load resolves — drives copy like "semua cabang" vs
  // "cabang Anda" on the page, and whether price columns render at all.
  const [scope, setScope]               = useState<'all' | 'branch'>('all')
  const [canSeePricing, setCanSeePricing] = useState(true)

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    const result = await fetchOrdersStats({ month, year })
    setStats({
      total: result.total, booking: result.booking, confirmed: result.confirmed,
      inProgress: result.inProgress, completed: result.completed, cancelled: result.cancelled,
      belumLunas: result.belumLunas, lunas: result.lunas,
    })
    setScope(result.scope)
    setStatsLoading(false)
  }, [month, year])

  const loadRows = useCallback(async (currentPage: number) => {
    setLoading(true)
    const result = await fetchOrdersList({
      page: currentPage, pageSize: PAGE_SIZE,
      search, status: statusFilter, payment: paymentFilter, month, year,
    })
    setRows(result.rows)
    setTotal(result.total)
    setScope(result.scope)
    setCanSeePricing(result.canSeePricing)
    setLoading(false)
  }, [search, statusFilter, paymentFilter, month, year])

  useEffect(() => {
    setPage(1)
    loadStats()
    loadRows(1)
  }, [search, statusFilter, paymentFilter, month, year, loadStats, loadRows])

  function handlePage(p: number) {
    setPage(p)
    loadRows(p)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const fromIdx    = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const toIdx      = Math.min(page * PAGE_SIZE, total)

  return {
    rows, total, stats, loading, statsLoading,
    page, totalPages, fromIdx, toIdx,
    scope, canSeePricing,
    handlePage,
    refresh: () => { loadStats(); loadRows(page) },
  }
}
