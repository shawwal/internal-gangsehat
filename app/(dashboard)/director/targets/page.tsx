'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, PlusCircle, Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

import { TargetStats }   from '@/components/target/TargetStats'
import { TargetFilters } from '@/components/target/TargetFilters'
import { TargetCard }    from '@/components/target/TargetCard'

import { BranchTargetStats }   from '@/components/target/BranchTargetStats'
import { BranchTargetFilters } from '@/components/target/BranchTargetFilters'
import { BranchTargetCard }    from '@/components/target/BranchTargetCard'
import { BranchTargetForm }    from '@/components/target/BranchTargetForm'
import type { BranchTargetFormState } from '@/components/target/BranchTargetForm'

import { Pagination } from '@/components/leave/Pagination'

import type {
  TargetRow, BranchOption,
  TargetStats as TargetStatsType,
  TargetFilters as TargetFiltersType,
  BranchTargetRow,
  BranchTargetFilters as BranchTargetFiltersType,
} from '@/components/target/types'
import {
  DEFAULT_FILTERS, DEFAULT_BRANCH_FILTERS, PAGE_SIZE,
} from '@/components/target/types'

type TopTab = 'staff' | 'branch'

const now = new Date()

function defaultBranchForm(): BranchTargetFormState {
  return {
    branchId: '',
    bulan: now.getMonth() + 1,
    tahun: now.getFullYear(),
    target_ta: 0,
    target_paket_klinik: 0,
    target_kunjungan: 0,
    target_visit: 0,
    notes: '',
  }
}

export default function DirectorTargetsPage() {
  // ── Role detection ─────────────────────────────────────────────────────
  const [role, setRole]             = useState<'director' | 'manager' | null>(null)
  const [myBranchId, setMyBranchId] = useState<string | null>(null)
  const [myBranchName, setMyBranchName] = useState<string>('')

  // ── Shared ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TopTab>('branch')
  const [branches, setBranches]   = useState<BranchOption[]>([])

  const todayLabel = now.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // ── Staff target state ─────────────────────────────────────────────────
  const [rows, setRows]         = useState<TargetRow[]>([])
  const [total, setTotal]       = useState(0)
  const [stats, setStats]       = useState<TargetStatsType>({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [filters, setFilters]   = useState<TargetFiltersType>(DEFAULT_FILTERS)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)

  // ── Branch target state ────────────────────────────────────────────────
  const [bRows, setBRows]             = useState<BranchTargetRow[]>([])
  const [bTotal, setBTotal]           = useState(0)
  const [bStats, setBStats]           = useState<TargetStatsType>({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [bFilters, setBFilters]       = useState<BranchTargetFiltersType>(DEFAULT_BRANCH_FILTERS)
  const [bPage, setBPage]             = useState(1)
  const [bLoading, setBLoading]       = useState(true)
  const [bShowForm, setBShowForm]     = useState(false)
  const [bEditTarget, setBEditTarget] = useState<BranchTargetRow | null>(null)
  const [bForm, setBForm]             = useState<BranchTargetFormState>(defaultBranchForm())
  const [bSaving, setBSaving]         = useState(false)
  const [bToast, setBToast]           = useState<{ msg: string; ok: boolean } | null>(null)

  // ── Init: detect role + load branches ─────────────────────────────────
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('internal_profiles')
        .select('role, branch_id, branches!branch_id(name)')
        .eq('id', user.id)
        .single()

      if (!profile) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = profile as any
      setRole(p.role)
      setMyBranchId(p.branch_id ?? null)
      setMyBranchName(p.branches?.name ?? '')

      const { data: branchData } = await supabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      setBranches((branchData ?? []) as BranchOption[])
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // auto-dismiss toast
  useEffect(() => {
    if (!bToast) return
    const t = setTimeout(() => setBToast(null), 4000)
    return () => clearTimeout(t)
  }, [bToast])

  // ── Staff targets logic (unchanged) ───────────────────────────────────

  async function resolveStaffIds(supabase: ReturnType<typeof createClient>, search: string) {
    if (!search.trim()) return null
    const term = `%${search.trim()}%`
    const { data: profiles } = await supabase
      .from('internal_profiles')
      .select('id')
      .or(`full_name.ilike.${term},email.ilike.${term}`)
    return (profiles ?? []).map((p: { id: string }) => p.id)
  }

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
      if (status)              q = q.eq('status', status)
      if (f.branchId !== 'all') q = q.eq('branch_id', f.branchId)
      if (f.month !== 'all')   q = q.eq('bulan', Number(f.month))
      if (f.year !== 'all')    q = q.eq('tahun', Number(f.year))
      if (staffIds)            q = q.in('staff_id', staffIds)
      const { count } = await q
      return count ?? 0
    }
    const [all, pending, approved, rejected] = await Promise.all([
      countFor(), countFor('pending'), countFor('approved'), countFor('rejected'),
    ])
    setStats({ total: all, pending, approved, rejected })
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (staffIds)             q = q.in('staff_id', staffIds)
    const { data, count, error } = await q
    if (error) console.error('[director/targets] loadRows error:', error)
    setRows((data ?? []) as unknown as TargetRow[])
    setTotal(count ?? 0)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const supabase = createClient()

  async function handleApprove(id: string) {
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
    const { error } = await supabase.from('staff_targets').delete().eq('id', id)
    if (error) { console.error('[director/targets] delete error:', error); return }
    const newTotal = total - 1
    const maxPage  = Math.max(1, Math.ceil(newTotal / PAGE_SIZE))
    const nextPage = Math.min(page, maxPage)
    setPage(nextPage)
    loadStats(filters)
    loadRows(nextPage, filters)
  }

  // ── Branch targets logic ───────────────────────────────────────────────

  const loadBStats = useCallback(async (f: BranchTargetFiltersType) => {
    const client = createClient()
    async function countFor(status?: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = client.from('branch_targets').select('id', { count: 'exact', head: true })
      if (status)              q = q.eq('status', status)
      if (f.branchId !== 'all') q = q.eq('branch_id', f.branchId)
      if (f.month !== 'all')   q = q.eq('bulan', Number(f.month))
      if (f.year !== 'all')    q = q.eq('tahun', Number(f.year))
      const { count } = await q
      return count ?? 0
    }
    const [all, pending, approved, rejected] = await Promise.all([
      countFor(), countFor('pending'), countFor('approved'), countFor('rejected'),
    ])
    setBStats({ total: all, pending, approved, rejected })
  }, [])

  const loadBRows = useCallback(async (currentPage: number, f: BranchTargetFiltersType) => {
    setBLoading(true)
    const client = createClient()
    const from = (currentPage - 1) * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = client
      .from('branch_targets')
      .select(`
        id, branch_id, bulan, tahun,
        target_ta, target_paket_klinik, target_kunjungan, target_visit,
        notes, status, rejection_note, created_at,
        branches!branch_id(name),
        internal_profiles!set_by(full_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
    if (f.status !== 'all')    q = q.eq('status', f.status)
    if (f.branchId !== 'all')  q = q.eq('branch_id', f.branchId)
    if (f.month !== 'all')     q = q.eq('bulan', Number(f.month))
    if (f.year !== 'all')      q = q.eq('tahun', Number(f.year))
    const { data, count, error } = await q
    if (error) console.error('[director/targets] loadBRows error:', error)
    setBRows((data ?? []) as unknown as BranchTargetRow[])
    setBTotal(count ?? 0)
    setBLoading(false)
  }, [])

  useEffect(() => {
    setBPage(1)
    loadBStats(bFilters)
    loadBRows(1, bFilters)
  }, [bFilters, loadBStats, loadBRows])

  const handleBPage = useCallback((p: number) => {
    setBPage(p)
    loadBRows(p, bFilters)
  }, [bFilters, loadBRows])

  async function handleBApprove(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('branch_targets').update({
      status: 'approved',
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
      rejection_note: null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    loadBStats(bFilters)
    loadBRows(bPage, bFilters)
  }

  async function handleBReject(id: string, note: string) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('branch_targets').update({
      status: 'rejected',
      rejection_note: note,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    loadBStats(bFilters)
    loadBRows(bPage, bFilters)
  }

  async function handleBDelete(id: string) {
    const { error } = await supabase.from('branch_targets').delete().eq('id', id)
    if (error) { console.error('[director/targets] delete branch target error:', error); return }
    const newTotal = bTotal - 1
    const maxPage  = Math.max(1, Math.ceil(newTotal / PAGE_SIZE))
    const nextPage = Math.min(bPage, maxPage)
    setBPage(nextPage)
    loadBStats(bFilters)
    loadBRows(nextPage, bFilters)
  }

  function openBCreate() {
    setBEditTarget(null)
    setBForm(defaultBranchForm())
    setBShowForm(true)
  }

  function openBEdit(t: BranchTargetRow) {
    setBEditTarget(t)
    setBForm({
      branchId: t.branch_id,
      bulan: t.bulan,
      tahun: t.tahun,
      target_ta: t.target_ta,
      target_paket_klinik: t.target_paket_klinik,
      target_kunjungan: t.target_kunjungan,
      target_visit: t.target_visit,
      notes: t.notes ?? '',
    })
    setBShowForm(true)
  }

  function cancelBForm() {
    setBShowForm(false)
    setBEditTarget(null)
    setBForm(defaultBranchForm())
  }

  async function handleBSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setBSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBSaving(false); return }

    const isManager = role === 'manager'
    const branchId = isManager ? myBranchId : bForm.branchId
    if (!branchId) { setBSaving(false); return }

    const payload = {
      branch_id:           branchId,
      bulan:               bForm.bulan,
      tahun:               bForm.tahun,
      target_ta:           bForm.target_ta,
      target_paket_klinik: bForm.target_paket_klinik,
      target_kunjungan:    bForm.target_kunjungan,
      target_visit:        bForm.target_visit,
      notes:               bForm.notes.trim() || null,
      set_by:              user.id,
      status:              'pending',
      updated_at:          new Date().toISOString(),
    }

    let error
    if (bEditTarget) {
      ;({ error } = await supabase.from('branch_targets').update(payload).eq('id', bEditTarget.id))
    } else {
      ;({ error } = await supabase.from('branch_targets').insert(payload))
    }

    setBSaving(false)

    if (error) {
      console.error('[director/targets] branch target save error:', error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (error as any).code === '23505'
        ? 'Target bulan ini sudah ada. Gunakan tombol Edit.'
        : 'Gagal menyimpan target. Coba lagi.'
      setBToast({ msg, ok: false })
    } else {
      setBToast({ msg: bEditTarget ? 'Target berhasil diperbarui.' : 'Target berhasil dikirim.', ok: true })
      cancelBForm()
      loadBStats(bFilters)
      loadBRows(bPage, bFilters)
    }
  }

  const isManager = role === 'manager'

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Toast */}
      {bToast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium text-white transition-all ${bToast.ok ? 'bg-chart-4' : 'bg-destructive'}`}>
          {bToast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {isManager ? `Target — ${myBranchName || '...'}` : 'Target'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isManager
              ? 'Ajukan dan pantau target cabang Anda'
              : 'Tinjau dan setujui target bulanan seluruh cabang'}
          </p>
        </div>
        <span className="text-xs bg-muted px-3 py-1.5 rounded-2xl text-muted-foreground shrink-0">
          {todayLabel}
        </span>
      </div>

      {/* Top-level tabs — only after role is known */}
      {role !== null && (
        <div className="flex gap-2">
          {([
            { value: 'branch' as TopTab, label: 'Target Cabang' },
            { value: 'staff' as TopTab, label: 'Target Staff' },
          ] as const).map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === tab.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-foreground/60 hover:text-foreground hover:bg-muted'
              }`}
            >
              {tab.label}
              {tab.value === 'staff' && stats.pending > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-destructive/80 text-white text-[10px] font-bold leading-none">
                  {stats.pending > 9 ? '9+' : stats.pending}
                </span>
              )}
              {tab.value === 'branch' && bStats.pending > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-destructive/80 text-white text-[10px] font-bold leading-none">
                  {bStats.pending > 9 ? '9+' : bStats.pending}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── TAB: Staff Targets ── */}
      {activeTab === 'staff' && (
        <>
          <TargetStats stats={stats} />

          <TargetFilters
            filters={filters}
            branches={branches}
            pendingCount={stats.pending}
            onChange={setFilters}
          />

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

          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={handlePage} />
        </>
      )}

      {/* ── TAB: Branch Targets ── */}
      {activeTab === 'branch' && (
        <>
          {/* Add button */}
          {!bShowForm && (
            <div className="flex justify-end">
              <button
                onClick={openBCreate}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
              >
                <PlusCircle size={15} />
                {isManager ? 'Ajukan Target Cabang' : 'Tambah Target Cabang'}
              </button>
            </div>
          )}

          {/* Form */}
          {bShowForm && (
            <BranchTargetForm
              editTarget={bEditTarget}
              form={bForm}
              saving={bSaving}
              branches={branches}
              isManager={isManager}
              onChange={setBForm}
              onSubmit={handleBSubmit}
              onCancel={cancelBForm}
            />
          )}

          <BranchTargetStats stats={bStats} />

          <BranchTargetFilters
            filters={bFilters}
            branches={branches}
            pendingCount={bStats.pending}
            isManager={isManager}
            onChange={setBFilters}
          />

          {bLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse bg-muted rounded-3xl h-40" />
              ))}
            </div>
          ) : bRows.length === 0 ? (
            <div className="flex flex-col items-center py-16 px-4 bg-muted/30 rounded-3xl gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Building2 size={22} className="text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {bStats.total === 0 ? 'Belum ada target cabang' : 'Tidak ada hasil yang cocok'}
              </p>
              <p className="text-xs text-muted-foreground text-center">
                {bStats.total === 0
                  ? isManager
                    ? 'Ajukan target bulanan cabang Anda untuk disetujui direktur.'
                    : 'Target bulanan dari semua cabang akan muncul di sini.'
                  : 'Coba ubah filter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {bRows.map(target => (
                <BranchTargetCard
                  key={target.id}
                  target={target}
                  isManager={isManager}
                  onApprove={!isManager ? handleBApprove : undefined}
                  onReject={!isManager ? handleBReject : undefined}
                  onDelete={!isManager ? handleBDelete : undefined}
                  onEdit={isManager ? openBEdit : undefined}
                />
              ))}
            </div>
          )}

          <Pagination page={bPage} pageSize={PAGE_SIZE} total={bTotal} onPage={handleBPage} />
        </>
      )}
    </div>
  )
}
