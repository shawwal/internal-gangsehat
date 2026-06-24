'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PAGE_SIZE } from './constants'
import { applyDateFilter } from './helpers'
import type { OrderRow, Stats } from './types'

const EMPTY_STATS: Stats = {
  total: 0, booking: 0, confirmed: 0, inProgress: 0,
  completed: 0, cancelled: 0, belumLunas: 0, lunas: 0,
}

async function resolvePaymentIds(supabase: ReturnType<typeof createClient>, filter: string) {
  if (!filter) return null
  const { data } = await supabase
    .from('internal_order_meta')
    .select('booking_id')
    .eq('status_bayar', filter)
  return (data ?? []).map((m: { booking_id: string }) => m.booking_id)
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

  const loadRows = useCallback(async (currentPage: number) => {
    setLoading(true)
    const supabase = createClient()
    const from = (currentPage - 1) * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

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
        patients (
          encrypted_name,
          patient_packages ( id, package_name, total_sessions, t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, status )
        ),
        therapists ( profiles ( full_name ) ),
        internal_order_meta ( kode_transaksi, status_bayar )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (statusFilter)        q = q.eq('status', statusFilter)
    if (paymentIds !== null) q = q.in('id', paymentIds)
    if (search.trim())       q = q.or(`guest_name.ilike.%${search.trim()}%,service_type.ilike.%${search.trim()}%`)
    q = applyDateFilter(q, month, year)

    const { data, count } = await q
    setRows((data ?? []) as OrderRow[])
    setTotal(count ?? 0)
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
    handlePage,
    refresh: () => { loadStats(); loadRows(page) },
  }
}
