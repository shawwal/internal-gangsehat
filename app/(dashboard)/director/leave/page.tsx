'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LeaveStats } from '@/components/leave/LeaveStats'
import { LeaveFilters } from '@/components/leave/LeaveFilters'
import { DirectorLeaveHeader } from '@/components/leave/DirectorLeaveHeader'
import { DirectorLeaveList } from '@/components/leave/DirectorLeaveList'
import { SelectToolbar } from '@/components/leave/SelectToolbar'
import { Pagination } from '@/components/leave/Pagination'
import { ConfirmDialog } from '@/components/leave/ConfirmDialog'
import type { LeaveRow, BranchOption } from '@/components/leave/types'
import type { LeaveStats as LeaveStatsType, LeaveFilters as LeaveFiltersType } from '@/components/leave/types'
import { DEFAULT_FILTERS, PAGE_SIZE } from '@/components/leave/types'

/** Extract the storage object path from a Supabase public URL */
function proofStoragePath(url: string): string | null {
  const marker = '/leave-proofs/'
  const idx = url.indexOf(marker)
  return idx === -1 ? null : url.slice(idx + marker.length)
}

/** Delete proof file(s) from storage — best-effort, never throws */
async function deleteProofFiles(supabase: ReturnType<typeof createClient>, urls: (string | null)[]) {
  const paths = urls
    .filter(Boolean)
    .map(u => proofStoragePath(u!))
    .filter(Boolean) as string[]
  if (paths.length > 0) {
    await supabase.storage.from('leave-proofs').remove(paths)
  }
}

export default function DirectorLeavePage() {
  const [rows, setRows]           = useState<LeaveRow[]>([])
  const [total, setTotal]         = useState(0)
  const [stats, setStats]         = useState<LeaveStatsType>({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [branches, setBranches]   = useState<BranchOption[]>([])
  const [filters, setFilters]     = useState<LeaveFiltersType>(DEFAULT_FILTERS)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(true)
  const [selectMode, setSelectMode]     = useState(false)
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [bulkConfirm, setBulkConfirm]   = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const todayLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  // Load branches once
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
      if (filters.branchId !== 'all') q = q.eq('branch_id', filters.branchId)
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

    if (currentFilters.status !== 'all')   q = q.eq('status', currentFilters.status)
    if (currentFilters.branchId !== 'all') q = q.eq('branch_id', currentFilters.branchId)
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
    if (error) console.error('[director/leave] loadRows error:', error)
    setRows((data ?? []) as unknown as LeaveRow[])
    setTotal(count ?? 0)
    setSelected(new Set())
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

  const allSelected  = rows.length > 0 && rows.every(r => selected.has(r.id))
  const someSelected = selected.size > 0

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map(r => r.id)))
  }

  function toggleOne(id: string) {
    setSelected(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const supabase = createClient()

  function afterDelete(deletedCount: number) {
    const newTotal = total - deletedCount
    const maxPage  = Math.max(1, Math.ceil(newTotal / PAGE_SIZE))
    const nextPage = Math.min(page, maxPage)
    setPage(nextPage)
    loadStats()
    loadRows(nextPage, filters)
  }

  async function handleApprove(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('leave_requests')
      .update({ status: 'approved', reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    loadStats()
    loadRows(page, filters)
  }

  async function handleReject(id: string, note: string) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('leave_requests')
      .update({
        status: 'rejected',
        rejection_note: note,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
    loadStats()
    loadRows(page, filters)
  }

  async function handleDelete(id: string) {
    const row = rows.find(r => r.id === id)
    await deleteProofFiles(supabase, [row?.proof_url ?? null])
    const { error } = await supabase.from('leave_requests').delete().eq('id', id)
    if (error) { console.error('[director/leave] delete error:', error); return }
    afterDelete(1)
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    const ids = Array.from(selected)
    const proofUrls = ids.map(id => rows.find(r => r.id === id)?.proof_url ?? null)
    await deleteProofFiles(supabase, proofUrls)
    const { error } = await supabase.from('leave_requests').delete().in('id', ids)
    if (error) { console.error('[director/leave] bulk delete error:', error) }
    setBulkDeleting(false)
    setBulkConfirm(false)
    exitSelectMode()
    afterDelete(ids.length)
  }

  return (
    <div className="space-y-6">
      <DirectorLeaveHeader
        loading={loading}
        hasRows={rows.length > 0}
        selectMode={selectMode}
        todayLabel={todayLabel}
        onToggleSelect={() => selectMode ? exitSelectMode() : setSelectMode(true)}
      />

      <LeaveStats stats={stats} />

      <LeaveFilters
        filters={filters}
        branches={branches}
        pendingCount={stats.pending}
        onChange={setFilters}
      />

      {selectMode && !loading && rows.length > 0 && (
        <SelectToolbar
          allSelected={allSelected}
          someSelected={someSelected}
          selectedCount={selected.size}
          onToggleAll={toggleAll}
          onBulkDelete={() => setBulkConfirm(true)}
        />
      )}

      <DirectorLeaveList
        loading={loading}
        rows={rows}
        totalStats={stats.total}
        selectMode={selectMode}
        selected={selected}
        onToggle={toggleOne}
        onApprove={handleApprove}
        onReject={handleReject}
        onDelete={handleDelete}
      />

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPage={handlePage}
      />

      {bulkConfirm && (
        <ConfirmDialog
          title="Hapus Permanen"
          description={`${selected.size} data cuti akan dihapus secara permanen termasuk semua file bukti. Tindakan ini tidak dapat dibatalkan.`}
          confirmLabel={`Hapus ${selected.size} Data`}
          danger
          loading={bulkDeleting}
          onConfirm={handleBulkDelete}
          onCancel={() => setBulkConfirm(false)}
        />
      )}
    </div>
  )
}
