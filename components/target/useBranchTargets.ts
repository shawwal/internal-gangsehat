'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/context/ToastContext'
import type { BranchTargetFormState } from './BranchTargetForm'
import type {
  BranchTargetRow,
  TargetStats as TargetStatsType,
  BranchTargetFilters as BranchTargetFiltersType,
} from './types'
import { DEFAULT_BRANCH_FILTERS, PAGE_SIZE } from './types'

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
    target_sesi: 0,
    notes: '',
  }
}

export function useBranchTargets(role: 'director' | 'manager' | null, myBranchId: string | null) {
  const [rows, setRows]         = useState<BranchTargetRow[]>([])
  const [total, setTotal]       = useState(0)
  const [stats, setStats]       = useState<TargetStatsType>({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [filters, setFilters]   = useState<BranchTargetFiltersType>(DEFAULT_BRANCH_FILTERS)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<BranchTargetRow | null>(null)
  const [form, setForm]         = useState<BranchTargetFormState>(defaultBranchForm())
  const [saving, setSaving]     = useState(false)
  const { showToast } = useToast()

  const isManager = role === 'manager'

  const loadStats = useCallback(async (f: BranchTargetFiltersType) => {
    const supabase = createClient()
    async function countFor(status?: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase.from('branch_targets').select('id', { count: 'exact', head: true })
      if (status)                q = q.eq('status', status)
      if (f.branchId !== 'all')  q = q.eq('branch_id', f.branchId)
      if (f.month !== 'all')     q = q.eq('bulan', Number(f.month))
      if (f.year !== 'all')      q = q.eq('tahun', Number(f.year))
      const { count } = await q
      return count ?? 0
    }
    const [all, pending, approved, rejected] = await Promise.all([
      countFor(), countFor('pending'), countFor('approved'), countFor('rejected'),
    ])
    setStats({ total: all, pending, approved, rejected })
  }, [])

  const loadRows = useCallback(async (currentPage: number, f: BranchTargetFiltersType) => {
    setLoading(true)
    const supabase = createClient()
    const from = (currentPage - 1) * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from('branch_targets')
      .select(`
        id, branch_id, bulan, tahun,
        target_ta, target_paket_klinik, target_kunjungan, target_visit, target_sesi,
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
    if (error) console.error('[useBranchTargets] loadRows error:', error)
    setRows((data ?? []) as unknown as BranchTargetRow[])
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
    await supabase.from('branch_targets').update({
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
    await supabase.from('branch_targets').update({
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
    const { error } = await supabase.from('branch_targets').delete().eq('id', id)
    if (error) { console.error('[useBranchTargets] delete error:', error); return }
    const newTotal = total - 1
    const maxPage  = Math.max(1, Math.ceil(newTotal / PAGE_SIZE))
    const nextPage = Math.min(page, maxPage)
    setPage(nextPage)
    loadStats(filters)
    loadRows(nextPage, filters)
  }

  function openCreate() {
    setEditTarget(null)
    setForm(defaultBranchForm())
    setShowForm(true)
  }

  function openEdit(t: BranchTargetRow) {
    setEditTarget(t)
    setForm({
      branchId: t.branch_id,
      bulan: t.bulan,
      tahun: t.tahun,
      target_ta: t.target_ta,
      target_paket_klinik: t.target_paket_klinik,
      target_kunjungan: t.target_kunjungan,
      target_visit: t.target_visit,
      target_sesi: t.target_sesi,
      notes: t.notes ?? '',
    })
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditTarget(null)
    setForm(defaultBranchForm())
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const branchId = isManager ? myBranchId : form.branchId
    if (!branchId) { setSaving(false); return }

    const payload = {
      branch_id:           branchId,
      bulan:               form.bulan,
      tahun:               form.tahun,
      target_ta:           form.target_ta,
      target_paket_klinik: form.target_paket_klinik,
      target_kunjungan:    form.target_kunjungan,
      target_visit:        form.target_visit,
      target_sesi:         form.target_sesi,
      notes:               form.notes.trim() || null,
      set_by:              user.id,
      status:              'pending',
      updated_at:          new Date().toISOString(),
    }

    let error
    if (editTarget) {
      ;({ error } = await supabase.from('branch_targets').update(payload).eq('id', editTarget.id))
    } else {
      ;({ error } = await supabase.from('branch_targets').insert(payload))
    }

    setSaving(false)

    if (error) {
      console.error('[useBranchTargets] save error:', error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (error as any).code === '23505'
        ? 'Target bulan ini sudah ada. Gunakan tombol Edit.'
        : 'Gagal menyimpan target. Coba lagi.'
      showToast(msg, 'error')
    } else {
      showToast(editTarget ? 'Target berhasil diperbarui.' : 'Target berhasil dikirim.', 'success')
      cancelForm()
      loadStats(filters)
      loadRows(page, filters)
    }
  }

  return {
    rows, total, stats, filters, page, loading,
    showForm, editTarget, form, saving, isManager,
    setFilters, setForm, handlePage,
    handleApprove, handleReject, handleDelete,
    openCreate, openEdit, cancelForm, handleSubmit,
  }
}
