'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarOff, CheckSquare, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { LeaveStats } from '@/components/leave/LeaveStats'
import { LeaveFilters } from '@/components/leave/LeaveFilters'
import { LeaveCard } from '@/components/leave/LeaveCard'
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
  const [selectMode, setSelectMode]   = useState(false)
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

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
    setSelected(new Set()) // clear selection on new page load
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

  // --- Selection helpers ---
  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id))
  const someSelected = selected.size > 0

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(rows.map(r => r.id)))
    }
  }

  function toggleOne(id: string) {
    setSelected(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  // --- Supabase client (stable ref) ---
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
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Cuti Staff</h1>
          <p className="text-sm text-muted-foreground">Tinjau dan kelola pengajuan cuti seluruh cabang</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!loading && rows.length > 0 && (
            <button
              onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                selectMode
                  ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <CheckSquare size={13} />
              {selectMode ? 'Selesai Pilih' : 'Pilih'}
            </button>
          )}
          <span className="text-xs bg-muted px-3 py-1.5 rounded-2xl text-muted-foreground">
            {todayLabel}
          </span>
        </div>
      </div>

      {/* Stats */}
      <LeaveStats stats={stats} />

      {/* Filters */}
      <LeaveFilters
        filters={filters}
        branches={branches}
        pendingCount={stats.pending}
        onChange={setFilters}
      />

      {/* Multi-select toolbar — only when selectMode is active */}
      {selectMode && !loading && rows.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary/5 border border-primary/20">
          {/* Select all */}
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-sm text-foreground hover:opacity-80 transition-opacity"
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
              allSelected ? 'bg-primary border-primary' : someSelected ? 'border-primary' : 'border-border bg-background'
            }`}>
              {allSelected && (
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {!allSelected && someSelected && (
                <div className="w-2 h-0.5 bg-primary rounded" />
              )}
            </div>
            <span className="text-xs font-medium">
              {allSelected ? 'Batalkan semua' : 'Pilih semua'}
            </span>
          </button>

          {someSelected && (
            <>
              <span className="text-xs text-muted-foreground">|</span>
              <span className="text-xs font-medium text-primary">{selected.size} dipilih</span>
              <button
                onClick={() => setBulkConfirm(true)}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-destructive text-white text-xs font-medium hover:bg-destructive/90 transition-colors"
              >
                <Trash2 size={12} /> Hapus {selected.size} Data
              </button>
            </>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-muted rounded-3xl h-24" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-16 px-4 bg-muted/30 rounded-3xl gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CalendarOff size={22} className="text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {stats.total === 0 ? 'Belum ada pengajuan cuti' : 'Tidak ada hasil yang cocok'}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            {stats.total === 0
              ? 'Pengajuan cuti dari staff semua cabang akan muncul di sini.'
              : 'Coba ubah kata kunci pencarian atau filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(leave => (
            <LeaveCard
              key={leave.id}
              leave={leave}
              isSelected={selectMode ? selected.has(leave.id) : undefined}
              onToggle={selectMode ? toggleOne : undefined}
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

      {/* Bulk delete confirmation */}
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
