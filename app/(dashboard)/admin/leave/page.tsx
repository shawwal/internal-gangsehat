'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LeaveStats } from '@/components/leave/LeaveStats'
import { LeaveFilters } from '@/components/leave/LeaveFilters'
import { DirectorLeaveList } from '@/components/leave/DirectorLeaveList'
import { Pagination } from '@/components/leave/Pagination'
import type { LeaveRow, BranchOption } from '@/components/leave/types'
import type { LeaveStats as LeaveStatsType, LeaveFilters as LeaveFiltersType } from '@/components/leave/types'
import { DEFAULT_FILTERS, PAGE_SIZE } from '@/components/leave/types'

export default function AdminLeavePage() {
  const [rows, setRows]         = useState<LeaveRow[]>([])
  const [total, setTotal]       = useState(0)
  const [stats, setStats]       = useState<LeaveStatsType>({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [filters, setFilters]   = useState<LeaveFiltersType>(DEFAULT_FILTERS)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)

  const todayLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // Load branches once — RLS scopes this to the admin's own branch
  useEffect(() => {
    createClient()
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setBranches((data ?? []) as BranchOption[]))
  }, [])

  const loadStats = useCallback(async () => {
    const supabase = createClient()

    async function countFor(status?: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase.from('leave_requests').select('id', { count: 'exact', head: true })
      if (status) q = q.eq('status', status)
      if (filters.month !== 'all') {
        const m = filters.month.padStart(2, '0')
        const y = filters.year !== 'all' ? filters.year : new Date().getFullYear()
        const nm = String(Number(m) % 12 + 1).padStart(2, '0')
        const ny = Number(m) === 12 ? Number(y) + 1 : y
        q = q.gte('start_date', `${y}-${m}-01`).lt('start_date', `${ny}-${nm}-01`)
      } else if (filters.year !== 'all') {
        q = q.gte('start_date', `${filters.year}-01-01`).lt('start_date', `${Number(filters.year) + 1}-01-01`)
      }
      if (filters.search.trim()) {
        const term = `%${filters.search.trim()}%`
        const { data: profiles } = await supabase
          .from('internal_profiles')
          .select('id')
          .or(`full_name.ilike.${term},email.ilike.${term}`)
        const ids = (profiles ?? []).map((p: { id: string }) => p.id)
        if (ids.length === 0) return 0
        q = q.in('staff_id', ids)
      }
      const { count } = await q
      return count ?? 0
    }

    const [all, pending, approved, rejected] = await Promise.all([
      countFor(), countFor('pending'), countFor('approved'), countFor('rejected'),
    ])
    setStats({ total: all, pending, approved, rejected })
  }, [filters])

  const loadRows = useCallback(async (currentPage: number, currentFilters: LeaveFiltersType) => {
    setLoading(true)
    const supabase = createClient()
    const from = (currentPage - 1) * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    let staffIds: string[] | null = null
    if (currentFilters.search.trim()) {
      const term = `%${currentFilters.search.trim()}%`
      const { data: profiles } = await supabase
        .from('internal_profiles')
        .select('id')
        .or(`full_name.ilike.${term},email.ilike.${term}`)
      staffIds = (profiles ?? []).map((p: { id: string }) => p.id)
      if (staffIds.length === 0) {
        setRows([]); setTotal(0); setLoading(false); return
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from('leave_requests')
      .select(`
        id, staff_id, branch_id, start_date, end_date, reason,
        proof_url, status, rejection_note, created_at,
        internal_profiles!staff_id(full_name, email),
        branches!branch_id(name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (currentFilters.status !== 'all') q = q.eq('status', currentFilters.status)
    if (currentFilters.month !== 'all') {
      const y  = currentFilters.year !== 'all' ? currentFilters.year : new Date().getFullYear()
      const m  = currentFilters.month.padStart(2, '0')
      const nm = String(Number(m) % 12 + 1).padStart(2, '0')
      const ny = Number(m) === 12 ? Number(y) + 1 : y
      q = q.gte('start_date', `${y}-${m}-01`).lt('start_date', `${ny}-${nm}-01`)
    } else if (currentFilters.year !== 'all') {
      q = q.gte('start_date', `${currentFilters.year}-01-01`)
           .lt('start_date', `${Number(currentFilters.year) + 1}-01-01`)
    }
    if (staffIds) q = q.in('staff_id', staffIds)

    const { data, count, error } = await q
    if (error) console.error('[admin/leave] loadRows error:', error)
    setRows((data ?? []) as unknown as LeaveRow[])
    setTotal(count ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    setPage(1)
    loadStats()
    loadRows(1, filters)
  }, [filters, loadStats, loadRows])

  const handlePage = useCallback((p: number) => {
    setPage(p)
    loadRows(p, filters)
  }, [filters, loadRows])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Cuti Staff</h1>
          <p className="text-sm text-muted-foreground">Lihat pengajuan cuti tim cabang Anda</p>
        </div>
        <span className="text-xs bg-muted px-3 py-1.5 rounded-2xl text-muted-foreground shrink-0">
          {todayLabel}
        </span>
      </div>

      <LeaveStats stats={stats} />

      <LeaveFilters
        filters={filters}
        branches={branches}
        pendingCount={stats.pending}
        onChange={setFilters}
      />

      <DirectorLeaveList
        loading={loading}
        rows={rows}
        totalStats={stats.total}
        selectMode={false}
        selected={new Set()}
        onToggle={() => {}}
      />

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPage={handlePage}
      />
    </div>
  )
}
