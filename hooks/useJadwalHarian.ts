'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchDailyVisits, updateVisitStatus, deleteVisit } from '@/app/actions/jadwal'
import { toIso, toHariIndonesia } from '@/components/jadwal/utils'
import type { DayStaffEntry, PendingLeaveInfo } from '@/components/jadwal/types'
import type { DailyVisit } from '@/app/actions/jadwal'
import type { VisitStatus } from '@/types'

export interface LeavePopoverState {
  staffName: string
  leave: PendingLeaveInfo
}

export function useJadwalHarian() {
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [staff, setStaff]               = useState<DayStaffEntry[]>([])
  const [visits, setVisits]             = useState<DailyVisit[]>([])
  const [loading, setLoading]           = useState(true)
  const [leavePopover, setLeavePopover] = useState<LeavePopoverState | null>(null)
  const [leaveSaving, setLeaveSaving]   = useState(false)
  const [canApproveLeave, setCanApproveLeave] = useState(false)
  const today = new Date()

  // Check if current user can approve leaves (hr / director / manager)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('internal_profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (data?.role && ['director', 'hr', 'manager'].includes(data.role)) {
        setCanApproveLeave(true)
      }
    })
  }, [])

  // Load schedules, leaves, and visits for a date
  const loadAll = useCallback(async (date: Date) => {
    setLoading(true)
    const supabase = createClient()
    const isoDate  = toIso(date)
    const hari     = toHariIndonesia(date)

    const [schedulesRes, leavesRes, visitsData] = await Promise.all([
      supabase
        .from('schedules')
        .select('staff_id, branch_id, shift, jam_mulai, jam_selesai, status, internal_profiles!staff_id(full_name, avatar_url)')
        .eq('hari', hari)
        .eq('status', 'AKTIF'),
      supabase
        .from('leave_requests')
        .select('id, staff_id, reason, status, start_date, end_date')
        .in('status', ['approved', 'pending'])
        .lte('start_date', isoDate)
        .gte('end_date', isoDate),
      fetchDailyVisits(isoDate),
    ])

    // Separate approved vs pending leaves
    const approvedLeaveMap = new Map<string, string>()
    const pendingLeaveMap  = new Map<string, { id: string; reason: string; start_date: string; end_date: string }>()
    for (const l of leavesRes.data ?? []) {
      if (l.status === 'approved') {
        approvedLeaveMap.set(l.staff_id, l.reason ?? '')
      } else if (l.status === 'pending' && !pendingLeaveMap.has(l.staff_id)) {
        pendingLeaveMap.set(l.staff_id, {
          id:         l.id,
          reason:     l.reason ?? '',
          start_date: l.start_date,
          end_date:   l.end_date,
        })
      }
    }

    // Build staff entries from schedules
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries = new Map<string, DayStaffEntry>()
    for (const row of (schedulesRes.data ?? []) as any[]) {
      const sid = row.staff_id as string
      if (entries.has(sid)) continue
      entries.set(sid, {
        staff_id:    sid,
        full_name:   row.internal_profiles?.full_name ?? 'Unknown',
        avatar_url:  row.internal_profiles?.avatar_url ?? null,
        branch_id:   row.branch_id ?? null,
        shift:       row.shift,
        jam_mulai:   row.jam_mulai?.slice(0, 5) ?? '08:00',
        jam_selesai: row.jam_selesai?.slice(0, 5) ?? '17:00',
        isOnLeave:   approvedLeaveMap.has(sid),
        leaveReason: approvedLeaveMap.get(sid) ?? null,
        hasSchedule: true,
        pendingLeave: pendingLeaveMap.get(sid) ?? null,
      })
    }

    // Include staff who have visits today but no schedule (edge case)
    for (const v of visitsData) {
      const sid = v.attending_staff_id
      if (!sid || entries.has(sid)) continue
      entries.set(sid, {
        staff_id:    sid,
        full_name:   'Staff',
        avatar_url:  null,
        branch_id:   v.branch_id ?? null,
        shift:       '',
        jam_mulai:   '08:00',
        jam_selesai: '20:00',
        isOnLeave:   approvedLeaveMap.has(sid),
        leaveReason: approvedLeaveMap.get(sid) ?? null,
        hasSchedule: false,
        pendingLeave: pendingLeaveMap.get(sid) ?? null,
      })
    }

    // Resolve names for edge-case staff
    const unknownIds = [...entries.values()].filter((s) => s.full_name === 'Staff').map((s) => s.staff_id)
    if (unknownIds.length > 0) {
      const { data: profiles } = await supabase
        .from('internal_profiles')
        .select('id, full_name, avatar_url')
        .in('id', unknownIds)
      for (const p of profiles ?? []) {
        const entry = entries.get(p.id)
        if (entry) {
          entry.full_name  = p.full_name
          entry.avatar_url = p.avatar_url ?? null
        }
      }
    }

    // Sort: on-leave last, then alphabetical
    const sorted = [...entries.values()].sort((a, b) => {
      if (a.isOnLeave !== b.isOnLeave) return a.isOnLeave ? 1 : -1
      return a.full_name.localeCompare(b.full_name)
    })

    setStaff(sorted)
    setVisits(visitsData)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll(selectedDate) }, [selectedDate, loadAll])

  function handleStatusChange(visitId: string, status: VisitStatus) {
    setVisits((vs) => vs.map((v) => v.id === visitId ? { ...v, status } : v))
    updateVisitStatus(visitId, status)
  }

  function handleDelete(visitId: string) {
    setVisits((vs) => vs.filter((v) => v.id !== visitId))
    deleteVisit(visitId)
  }

  async function handleLeaveAction(leaveId: string, action: 'approve' | 'reject') {
    setLeaveSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status:      action === 'approve' ? 'approved' : 'rejected',
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', leaveId)
    setLeaveSaving(false)
    if (error) { alert('Gagal: ' + error.message); return }
    setLeavePopover(null)
    loadAll(selectedDate)
  }

  return {
    today,
    selectedDate,
    setSelectedDate,
    staff,
    visits,
    loading,
    leavePopover,
    setLeavePopover,
    leaveSaving,
    canApproveLeave,
    loadAll,
    handleStatusChange,
    handleDelete,
    handleLeaveAction,
  }
}
