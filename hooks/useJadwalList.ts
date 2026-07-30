'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchJadwalListRows, type JadwalListRow } from '@/app/actions/jadwalList'
import { updateVisitStatus } from '@/app/actions/jadwal'
import { toIso } from '@/components/jadwal/utils'

export function useJadwalList() {
  const [selectedDate, setSelectedDate]         = useState(() => new Date())
  const [rows, setRows]                         = useState<JadwalListRow[]>([])
  const [loading, setLoading]                   = useState(true)
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
    setLoading(true)
    const data = await fetchJadwalListRows(toIso(date), selectedBranchId)
    setRows(data)
    setLoading(false)
  }, [selectedBranchId])

  useEffect(() => {
    if (selectedBranchId === undefined) return
    loadRows(selectedDate)
  }, [selectedDate, selectedBranchId, loadRows])

  async function handleCancel(visitId: string) {
    await updateVisitStatus(visitId, 'cancelled')
    await loadRows(selectedDate)
  }

  return {
    today, selectedDate, setSelectedDate,
    rows, loading,
    userRole,
    branches, selectedBranchId, setSelectedBranchId,
    reload: () => loadRows(selectedDate),
    handleCancel,
  }
}
