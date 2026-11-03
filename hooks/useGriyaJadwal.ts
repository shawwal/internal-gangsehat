'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchGriyaWeek, type GriyaWeek } from '@/app/actions/griyaJadwal'
import { getMondayOf, toIso } from '@/components/griya/constants'
import { useGriyaBranch } from '@/hooks/useGriyaBranch'

const EMPTY: GriyaWeek = { branchId: null, therapists: [], slots: [], visits: [], schedules: [] }

export function useGriyaJadwal() {
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [week, setWeek]         = useState<GriyaWeek>(EMPTY)
  const [loading, setLoading]   = useState(true)
  // caller role + branch (picked in the Griya layout) + feature gate
  const gate = useGriyaBranch()
  const role = gate.role
  const branchId = gate.loading ? undefined : gate.branchId
  const enabled = gate.loading ? null : gate.enabled
  const today = new Date()

  const weekMonday = toIso(getMondayOf(selectedDate))

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!branchId) return
    if (!opts?.silent) setLoading(true)
    const w = await fetchGriyaWeek(weekMonday, branchId)
    setWeek(w)
    setLoading(false)
  }, [branchId, weekMonday])

  // Instantly flips a cell to "hadir" (green) in local state, before the server
  // confirms — so the button feels snappy instead of waiting on the round-trip.
  // A subsequent silent reload() reconciles with the real row (or reverts on error).
  const markPresentOptimistic = useCallback((params: {
    visitId?: string | null
    slotId?: string | null
    dateIso: string
    patientId: string
    patientName: string
  }) => {
    setWeek((prev) => {
      let found = false
      const visits = prev.visits.map((v) => {
        const matches = params.visitId
          ? v.id === params.visitId
          : !!params.slotId && v.griya_slot_id === params.slotId && v.visit_date === params.dateIso
        if (!matches) return v
        found = true
        return { ...v, kehadiran: 'HADIR', status: 'completed' }
      })
      if (!found) {
        visits.push({
          id: `optimistic-${params.slotId ?? params.visitId}-${params.dateIso}`,
          patient_id: params.patientId,
          patient_name: params.patientName,
          patient_phone: '',
          griya_slot_id: params.slotId ?? null,
          attending_staff_id: null,
          visit_date: params.dateIso,
          visit_time: null,
          service_type: null,
          status: 'completed',
          kehadiran: 'HADIR',
          notes: null,
          package_id: null,
          layanan_id: null,
        })
      }
      return { ...prev, visits }
    })
  }, [])

  useEffect(() => {
    if (branchId === undefined) return
    if (!branchId) { setLoading(false); return }
    load()
  }, [branchId, weekMonday, load])

  const canEdit = gate.canEdit

  return {
    today, selectedDate, setSelectedDate,
    week, loading, role, branchId: branchId ?? null, enabled, canEdit,
    reload: load,
    markPresentOptimistic,
  }
}
