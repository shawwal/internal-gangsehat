'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  TargetRow,
  TargetStats as TargetStatsType,
  TargetFilters as TargetFiltersType,
} from './types'
import { DEFAULT_FILTERS, PAGE_SIZE } from './types'

async function resolveStaffIds(supabase: ReturnType<typeof createClient>, search: string) {
  if (!search.trim()) return null
  const term = `%${search.trim()}%`
  const { data: profiles } = await supabase
    .from('internal_profiles')
    .select('id')
    .or(`full_name.ilike.${term},email.ilike.${term}`)
  return (profiles ?? []).map((p: { id: string }) => p.id)
}

export function useStaffTargets() {
  const [rows, setRows]       = useState<TargetRow[]>([])
  const [total, setTotal]     = useState(0)
  const [stats, setStats]     = useState<TargetStatsType>({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [filters, setFilters] = useState<TargetFiltersType>(DEFAULT_FILTERS)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async (f: TargetFiltersType) => {
    const supabase = createClient()
    const staffIds = await resolveStaffIds(supabase, f.search)
    if (staffIds !== null && staffIds.length === 0) {
      setStats({ total: 0, pending: 0, approved: 0, rejected: 0 })
      return
    }
    async function countFor(status?: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase.from('staff_targets').select('id', { count: 'exact', head: true })
      if (status)               q = q.eq('status', status)
      if (f.branchId !== 'all') q = q.eq('branch_id', f.branchId)
      if (f.month !== 'all')    q = q.eq('bulan', Number(f.month))
      if (f.year !== 'all')     q = q.eq('tahun', Number(f.year))
      if (staffIds)             q = q.in('staff_id', staffIds)
      const { count } = await q
      return count ?? 0
    }
    const [all, pending, approved, rejected] = await Promise.all([
      countFor(), countFor('pending'), countFor('approved'), countFor('rejected'),
    ])
    setStats({ total: all, pending, approved, rejected })
  }, [])

  const loadRows = useCallback(async (currentPage: number, f: TargetFiltersType) => {
    setLoading(true)
    const supabase = createClient()
    const staffIds = await resolveStaffIds(supabase, f.search)
    if (staffIds !== null && staffIds.length === 0) {
      setRows([]); setTotal(0); setLoading(false); return
    }
    const from = (currentPage - 1) * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from('staff_targets')
      .select(`
        id, staff_id, branch_id, bulan, tahun,
        target_ta, target_paket_klinik, target_kunjungan, target_visit, target_sesi,
        notes, status, rejection_note, created_at,
        internal_profiles!staff_id(full_name, email),
        branches!branch_id(name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
    if (f.status !== 'all')   q = q.eq('status', f.status)
    if (f.branchId !== 'all') q = q.eq('branch_id', f.branchId)
    if (f.month !== 'all')    q = q.eq('bulan', Number(f.month))
    if (f.year !== 'all')     q = q.eq('tahun', Number(f.year))
    if (staffIds)             q = q.in('staff_id', staffIds)
    const { data, count, error } = await q
    if (error) console.error('[useStaffTargets] loadRows error:', error)
    setRows((data ?? []) as unknown as TargetRow[])
    setTotal(count ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    setPage(1)
    loadStats(filters)
    loadRows(1, filters)
  }, [filters, loadStats, loadRows])

  const handlePage = useCallback((p: number) => {
    setPage(p)
    loadRows(p, filters)
  }, [filters, loadRows])

  async function handleApprove(id: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('staff_targets').update({
      status: 'approved',
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
      rejection_note: null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    loadStats(filters)
    loadRows(page, filters)
  }

  async function handleReject(id: string, note: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('staff_targets').update({
      status: 'rejected',
      rejection_note: note,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    loadStats(filters)
    loadRows(page, filters)
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('staff_targets').delete().eq('id', id)
    if (error) { console.error('[useStaffTargets] delete error:', error); return }
    const newTotal = total - 1
    const maxPage  = Math.max(1, Math.ceil(newTotal / PAGE_SIZE))
    const nextPage = Math.min(page, maxPage)
    setPage(nextPage)
    loadStats(filters)
    loadRows(nextPage, filters)
  }

  return {
    rows, total, stats, filters, page, loading,
    setFilters, handlePage, handleApprove, handleReject, handleDelete,
  }
}
