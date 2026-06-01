'use client'

import { useCallback, useEffect, useState } from 'react'
import { Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TargetStats } from '@/components/target/TargetStats'
import { TargetFilters } from '@/components/target/TargetFilters'
import { TargetCard } from '@/components/target/TargetCard'
import { Pagination } from '@/components/leave/Pagination'
import type { TargetRow, BranchOption } from '@/components/target/types'
import type { TargetStats as TargetStatsType, TargetFilters as TargetFiltersType } from '@/components/target/types'
import { DEFAULT_FILTERS, PAGE_SIZE } from '@/components/target/types'

export default function DirectorTargetsPage() {
  const [rows, setRows]         = useState<TargetRow[]>([])
  const [total, setTotal]       = useState(0)
  const [stats, setStats]       = useState<TargetStatsType>({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [filters, setFilters]   = useState<TargetFiltersType>(DEFAULT_FILTERS)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)

  const todayLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // Load branches once
  useEffect(() => {
    createClient()
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setBranches((data ?? []) as BranchOption[]))
  }, [])

  // Build a base query with current filters applied (shared between stats + rows)
  async function resolveStaffIds(supabase: ReturnType<typeof createClient>, search: string) {
    if (!search.trim()) return null
    const term = `%${search.trim()}%`
    const { data: profiles } = await supabase
      .from('internal_profiles')
      .select('id')
      .or(`full_name.ilike.${term},email.ilike.${term}`)
    return (profiles ?? []).map((p: { id: string }) => p.id)
  }

  // Load stats (not affected by pagination)
  const loadStats = useCallback(async (f: TargetFiltersType) => {
    const supabase = createClient()
    const staffIds = await resolveStaffIds(supabase, f.search)
    if (staffIds !== null && staffIds.length === 0) {
      setStats({ total: 0, pending: 0, approved: 0, rejected: 0 })
      return
    }

    async function countFor(status?: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from('staff_targets')
        .select('id', { count: 'exact', head: true })
      if (status) q = q.eq('status', status)
      if (f.branchId !== 'all') q = q.eq('branch_id', f.branchId)
      if (f.month !== 'all') q = q.eq('bulan', Number(f.month))
      if (f.year !== 'all')  q = q.eq('tahun', Number(f.year))
      if (staffIds) q = q.in('staff_id', staffIds)
      const { count } = await q
      return count ?? 0
    }

    const [all, pending, approved, rejected] = await Promise.all([
      countFor(), countFor('pending'), countFor('approved'), countFor('rejected'),
    ])
    setStats({ total: all, pending, approved, rejected })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load paginated rows
  const loadRows = useCallback(async (currentPage: number, f: TargetFiltersType) => {
    setLoading(true)
    const supabase = createClient()
    const staffIds = await resolveStaffIds(supabase, f.search)

    if (staffIds !== null && staffIds.length === 0) {
      setRows([])
      setTotal(0)
      setLoading(false)
      return
    }

    const from = (currentPage - 1) * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from('staff_targets')
      .select(`
        id, staff_id, branch_id, bulan, tahun,
        target_ta, target_paket_klinik, target_kunjungan, target_visit,
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
    if (staffIds) q = q.in('staff_id', staffIds)

    const { data, count, error } = await q
    if (error) console.error('[director/targets] loadRows error:', error)
    setRows((data ?? []) as unknown as TargetRow[])
    setTotal(count ?? 0)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When filters change, reset to page 1 and reload both
  useEffect(() => {
    setPage(1)
    loadStats(filters)
    loadRows(1, filters)
  }, [filters, loadStats, loadRows])

  const handlePage = useCallback((p: number) => {
    setPage(p)
    loadRows(p, filters)
  }, [filters, loadRows])

  const supabase = createClient()

  async function handleApprove(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('staff_targets')
      .update({
        status: 'approved',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        rejection_note: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    loadStats(filters)
    loadRows(page, filters)
  }

  async function handleReject(id: string, note: string) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('staff_targets')
      .update({
        status: 'rejected',
        rejection_note: note,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    loadStats(filters)
    loadRows(page, filters)
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('staff_targets').delete().eq('id', id)
    if (error) { console.error('[director/targets] delete error:', error); return }
    const newTotal = total - 1
    const maxPage  = Math.max(1, Math.ceil(newTotal / PAGE_SIZE))
    const nextPage = Math.min(page, maxPage)
    setPage(nextPage)
    loadStats(filters)
    loadRows(nextPage, filters)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Target Staff</h1>
          <p className="text-sm text-muted-foreground">Tinjau dan setujui target bulanan seluruh cabang</p>
        </div>
        <span className="text-xs bg-muted px-3 py-1.5 rounded-2xl text-muted-foreground shrink-0">
          {todayLabel}
        </span>
      </div>

      {/* Stats */}
      <TargetStats stats={stats} />

      {/* Filters */}
      <TargetFilters
        filters={filters}
        branches={branches}
        pendingCount={stats.pending}
        onChange={setFilters}
      />

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-muted rounded-3xl h-40" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-16 px-4 bg-muted/30 rounded-3xl gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Target size={22} className="text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {stats.total === 0 ? 'Belum ada pengajuan target' : 'Tidak ada hasil yang cocok'}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            {stats.total === 0
              ? 'Target bulanan dari staff semua cabang akan muncul di sini.'
              : 'Coba ubah kata kunci pencarian atau filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(target => (
            <TargetCard
              key={target.id}
              target={target}
              onApprove={handleApprove}
              onReject={handleReject}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPage={handlePage}
      />
    </div>
  )
}
