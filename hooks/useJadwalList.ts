'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchJadwalListRows, type JadwalListRow } from '@/app/actions/jadwalList'
import { updateVisit, updateVisitStatus } from '@/app/actions/jadwal'
import { ensureSlotVisit } from '@/app/actions/griyaJadwal'
import { toIso } from '@/components/jadwal/utils'

export function useJadwalList() {
  // Inclusive range; a single day when both ends match (the DateNav chips).
  const [range, setRange]                       = useState(() => ({ from: new Date(), to: new Date() }))
  const [rows, setRows]                         = useState<JadwalListRow[]>([])
  const [loading, setLoading]                   = useState(true)
  const [error, setError]                       = useState<string | null>(null)
  const requestId                               = useRef(0)
  const [userRole, setUserRole]                 = useState<string | null>(null)
  const [branches, setBranches]                 = useState<{ id: string; name: string }[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string | null | undefined>(undefined)
  const today = new Date()

  useEffect(() => {
    async function loadMeta() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: profile }, { data: branchList }] = await Promise.all([
        supabase.from('internal_profiles').select('role, branch_id').eq('id', user.id).single(),
        supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
      ])
      if (profile?.role) setUserRole(profile.role)
      const list = branchList ?? []
      setBranches(list)
      setSelectedBranchId(profile?.branch_id ?? list[0]?.id ?? null)
    }
    loadMeta()
  }, [])

  const loadRows = useCallback(async (r: { from: Date; to: Date }) => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const data = await fetchJadwalListRows(toIso(r.from), toIso(r.to), selectedBranchId)
      if (id === requestId.current) setRows(data)
    } catch (e) {
      console.error('fetchJadwalListRows failed', e)
      if (id === requestId.current) {
        setRows([])
        setError('Gagal memuat jadwal. Coba muat ulang.')
      }
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [selectedBranchId])

  useEffect(() => {
    if (selectedBranchId === undefined) return
    loadRows(range)
  }, [range, selectedBranchId, loadRows])

  /** Griya virtual rows (master slot, no visit yet) get a real visit row first. */
  async function realVisitId(row: JadwalListRow): Promise<{ id?: string; error?: string }> {
    if (!row.is_virtual) return { id: row.id }
    if (!row.griya_slot_id) return { error: 'Slot tidak ditemukan' }
    const { error, visit } = await ensureSlotVisit(row.griya_slot_id, row.visit_date)
    if (error || !visit) return { error: error ?? 'Gagal membuat kunjungan' }
    return { id: visit.id }
  }

  async function handleCancel(row: JadwalListRow) {
    const { id } = await realVisitId(row)
    if (id) await updateVisitStatus(id, 'cancelled')
    await loadRows(range)
  }

  /** Persist an inline edit, then patch the local row (or drop it if moved out of the range). */
  async function handleEdit(
    row: JadwalListRow,
    patch: {
      visit_date?: string
      visit_time?: string | null
      attending_staff_id?: string | null
      chief_complaint?: string | null
      kehadiran?: string | null
      notes?: string | null
    },
    local: Partial<JadwalListRow> = {},
  ): Promise<string | null> {
    const real = await realVisitId(row)
    if (!real.id) return real.error ?? 'Gagal menyimpan'
    const { error } = await updateVisit(real.id, patch)
    if (error) return error
    if (row.is_virtual) {
      // The new visit row carries order_id/status etc. — reload rather than patch.
      await loadRows(range)
      return null
    }
    if (patch.visit_date && (patch.visit_date < toIso(range.from) || patch.visit_date > toIso(range.to))) {
      setRows((prev) => prev.filter((r) => r.id !== row.id))
    } else {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...patch, ...local } : r)))
    }
    return null
  }

  return {
    today,
    dateFrom: range.from, dateTo: range.to,
    setSelectedDate: (d: Date) => setRange({ from: d, to: d }),
    setDateRange: (from: Date, to: Date) => setRange(from <= to ? { from, to } : { from: to, to: from }),
    rows, loading, error,
    userRole,
    branches, selectedBranchId, setSelectedBranchId,
    reload: () => loadRows(range),
    handleCancel, handleEdit,
  }
}
