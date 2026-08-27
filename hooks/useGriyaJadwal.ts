'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchGriyaWeek, type GriyaWeek } from '@/app/actions/griyaJadwal'
import { getMondayOf, toIso } from '@/components/griya/constants'

const EMPTY: GriyaWeek = { branchId: null, therapists: [], slots: [], visits: [], schedules: [] }

export function useGriyaJadwal() {
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [week, setWeek]         = useState<GriyaWeek>(EMPTY)
  const [loading, setLoading]   = useState(true)
  const [role, setRole]         = useState<string | null>(null)
  const [branchId, setBranchId] = useState<string | null | undefined>(undefined)
  const [enabled, setEnabled]   = useState<boolean | null>(null)
  const today = new Date()

  // resolve caller role + branch + feature gate
  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setBranchId(null); return }
      const { data: profile } = await supabase
        .from('internal_profiles').select('role, branch_id').eq('id', user.id).single()
      setRole(profile?.role ?? null)

      let bid = profile?.branch_id ?? null
      if (!bid) {
        const { data: b } = await supabase
          .from('branches').select('id').ilike('name', '%Griya Anak%').eq('is_active', true).limit(1).maybeSingle()
        bid = b?.id ?? null
      }
      setBranchId(bid)

      if (!bid) { setEnabled(false); return }
      const { data: s } = await supabase
        .from('branch_griya_settings').select('enabled').eq('branch_id', bid).maybeSingle()
      setEnabled(profile?.role === 'director' ? true : (s?.enabled ?? false))
    })()
  }, [])

  const weekMonday = toIso(getMondayOf(selectedDate))

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!branchId) return
    if (!opts?.silent) setLoading(true)
    const w = await fetchGriyaWeek(weekMonday, branchId)
    setWeek(w)
    setLoading(false)
  }, [branchId, weekMonday])

  useEffect(() => {
    if (branchId === undefined) return
    if (!branchId) { setLoading(false); return }
    load()
  }, [branchId, weekMonday, load])

  const canEdit = !!role && ['director', 'manager', 'admin'].includes(role)

  return {
    today, selectedDate, setSelectedDate,
    week, loading, role, branchId: branchId ?? null, enabled, canEdit,
    reload: load,
  }
}
