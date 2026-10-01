'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchJadwalListRows, type JadwalListRow } from '@/app/actions/jadwalList'
import { updateVisit, updateVisitStatus } from '@/app/actions/jadwal'
import { toIso } from '@/components/jadwal/utils'

export function useJadwalList() {
  const [selectedDate, setSelectedDate]         = useState(() => new Date())
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

  const loadRows = useCallback(async (date: Date) => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const data = await fetchJadwalListRows(toIso(date), selectedBranchId)
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
    loadRows(selectedDate)
  }, [selectedDate, selectedBranchId, loadRows])

  async function handleCancel(visitId: string) {
    await updateVisitStatus(visitId, 'cancelled')
    await loadRows(selectedDate)
  }

  /** Persist an inline edit, then patch the local row (or drop it if moved to another date). */
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
    const { error } = await updateVisit(row.id, patch)
    if (error) return error
    if (patch.visit_date && patch.visit_date !== toIso(selectedDate)) {
      setRows((prev) => prev.filter((r) => r.id !== row.id))
    } else {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...patch, ...local } : r)))
    }
    return null
  }

  return {
    today, selectedDate, setSelectedDate,
    rows, loading, error,
    userRole,
    branches, selectedBranchId, setSelectedBranchId,
    reload: () => loadRows(selectedDate),
    handleCancel, handleEdit,
  }
}
