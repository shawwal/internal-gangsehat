'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchDailyVisits, updateVisitStatus, deleteVisit } from '@/app/actions/jadwal'
import { toIso, toHariIndonesia, getMondayOf } from '@/components/jadwal/utils'
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
  const [branches, setBranches]               = useState<{ id: string; name: string }[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string | null | undefined>(undefined)
  const today = new Date()

  // Load user role, branch, and branches list on mount
  useEffect(() => {
    async function loadMeta() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: profile }, { data: branchList }] = await Promise.all([
        supabase.from('internal_profiles').select('role, branch_id').eq('id', user.id).single(),
        supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
      ])
      if (profile?.role && ['director', 'hr', 'manager'].includes(profile.role)) {
        setCanApproveLeave(true)
      }
      const list = branchList ?? []
      setBranches(list)
      // Non-directors default to their own branch; directors default to first branch
      setSelectedBranchId(profile?.branch_id ?? list[0]?.id ?? null)
    }
    loadMeta()
  }, [])

  // Load schedules, leaves, and visits for a date
  const loadAll = useCallback(async (date: Date) => {
    setLoading(true)
    const supabase = createClient()
    const isoDate  = toIso(date)
    const hari     = toHariIndonesia(date)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function applyBranch(q: any) {
      return selectedBranchId ? q.eq('branch_id', selectedBranchId) : q
    }

    const [schedulesRes, leavesRes, visitsData, overridesRes, allTherapistsRes] = await Promise.all([
      applyBranch(
        supabase
          .from('schedules')
          .select('staff_id, branch_id, shift, jam_mulai, jam_selesai, status, internal_profiles!staff_id(full_name, avatar_url, nickname, gender)')
          .eq('hari', hari)
          .eq('status', 'AKTIF'),
      ),
      supabase
        .from('leave_requests')
        .select('id, staff_id, reason, status, start_date, end_date')
        .in('status', ['approved', 'pending'])
        .lte('start_date', isoDate)
        .gte('end_date', isoDate),
      fetchDailyVisits(isoDate, selectedBranchId),
      applyBranch(
        supabase
          .from('schedule_overrides')
          .select('id, staff_id, branch_id, hari, shift, jam_mulai, jam_selesai, reason, internal_profiles!staff_id(full_name, avatar_url, nickname, gender)')
          .eq('status', 'active')
          .lte('start_date', isoDate)
          .gte('end_date', isoDate),
      ),
      applyBranch(
        supabase
          .from('internal_profiles')
          .select('id, full_name, nickname, avatar_url, branch_id, gender')
          .eq('role', 'therapist')
          .eq('is_active', true)
          .order('full_name'),
      ),
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

    // Build override maps
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overrideRows = (overridesRes.data ?? []) as any[]
    // Staff whose override targets TODAY's hari → appear today with override details
    const overrideForToday = new Map<string, typeof overrideRows[0]>()
    // Staff whose override targets a DIFFERENT hari → suppress their regular schedule today
    const suppressedToday  = new Set<string>()
    for (const ov of overrideRows) {
      if (ov.hari === hari) {
        overrideForToday.set(ov.staff_id, ov)
      } else {
        suppressedToday.add(ov.staff_id)
      }
    }

    // Build staff entries from schedules
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries = new Map<string, DayStaffEntry>()
    for (const row of (schedulesRes.data ?? []) as any[]) {
      const sid = row.staff_id as string
      if (entries.has(sid)) continue
      // Skip staff who have been moved to a different day via override
      if (suppressedToday.has(sid)) continue
      const ov = overrideForToday.get(sid)
      entries.set(sid, {
        staff_id:    sid,
        full_name:   row.internal_profiles?.full_name ?? 'Unknown',
        nickname:    row.internal_profiles?.nickname ?? null,
        avatar_url:  row.internal_profiles?.avatar_url ?? null,
        branch_id:   ov?.branch_id ?? row.branch_id ?? null,
        gender:      (row.internal_profiles?.gender ?? null) as 'male' | 'female' | null,
        shift:       ov?.shift ?? row.shift,
        jam_mulai:   (ov?.jam_mulai ?? row.jam_mulai)?.slice(0, 5) ?? '08:00',
        jam_selesai: (ov?.jam_selesai ?? row.jam_selesai)?.slice(0, 5) ?? '17:00',
        isOnLeave:   approvedLeaveMap.has(sid),
        leaveReason: approvedLeaveMap.get(sid) ?? null,
        hasSchedule: true,
        pendingLeave: pendingLeaveMap.get(sid) ?? null,
        isOverride:  !!ov,
        overrideId:  ov?.id ?? null,
      })
    }

    // Add staff who appear via override but whose original schedule is on a different day
    for (const [sid, ov] of overrideForToday) {
      if (entries.has(sid)) continue  // already added from regular schedules
      entries.set(sid, {
        staff_id:    sid,
        full_name:   ov.internal_profiles?.full_name ?? 'Unknown',
        nickname:    ov.internal_profiles?.nickname ?? null,
        avatar_url:  ov.internal_profiles?.avatar_url ?? null,
        branch_id:   ov.branch_id ?? null,
        gender:      (ov.internal_profiles?.gender ?? null) as 'male' | 'female' | null,
        shift:       ov.shift,
        jam_mulai:   ov.jam_mulai?.slice(0, 5) ?? '08:00',
        jam_selesai: ov.jam_selesai?.slice(0, 5) ?? '17:00',
        isOnLeave:   approvedLeaveMap.has(sid),
        leaveReason: approvedLeaveMap.get(sid) ?? null,
        hasSchedule: true,
        pendingLeave: pendingLeaveMap.get(sid) ?? null,
        isOverride:  true,
        overrideId:  ov.id,
      })
    }

    // Include staff who have visits today but no schedule (edge case)
    for (const v of visitsData) {
      const sid = v.attending_staff_id
      if (!sid || entries.has(sid)) continue
      entries.set(sid, {
        staff_id:    sid,
        full_name:   'Staff',
        nickname:    null,
        avatar_url:  null,
        branch_id:   v.branch_id ?? null,
        gender:      null,
        shift:       '',
        jam_mulai:   '08:00',
        jam_selesai: '20:00',
        isOnLeave:   approvedLeaveMap.has(sid),
        leaveReason: approvedLeaveMap.get(sid) ?? null,
        hasSchedule: false,
        pendingLeave: pendingLeaveMap.get(sid) ?? null,
        isOverride:  false,
        overrideId:  null,
      })
    }

    // Add all active therapists who have no schedule or visits today (shown when toggle is on)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const t of (allTherapistsRes.data ?? []) as any[]) {
      if (entries.has(t.id)) continue
      entries.set(t.id, {
        staff_id:    t.id,
        full_name:   t.full_name ?? 'Unknown',
        nickname:    t.nickname ?? null,
        avatar_url:  t.avatar_url ?? null,
        branch_id:   t.branch_id ?? null,
        gender:      (t.gender ?? null) as 'male' | 'female' | null,
        shift:       '',
        jam_mulai:   '08:00',
        jam_selesai: '20:00',
        isOnLeave:   approvedLeaveMap.has(t.id),
        leaveReason: approvedLeaveMap.get(t.id) ?? null,
        hasSchedule: false,
        pendingLeave: pendingLeaveMap.get(t.id) ?? null,
        isOverride:  false,
        overrideId:  null,
      })
    }

    // Resolve names for edge-case staff
    const unknownIds = [...entries.values()].filter((s) => s.full_name === 'Staff').map((s) => s.staff_id)
    if (unknownIds.length > 0) {
      const { data: profiles } = await supabase
        .from('internal_profiles')
        .select('id, full_name, avatar_url, nickname, gender')
        .in('id', unknownIds)
      for (const p of profiles ?? []) {
        const entry = entries.get(p.id)
        if (entry) {
          entry.full_name  = p.full_name
          entry.avatar_url = p.avatar_url ?? null
          entry.nickname   = p.nickname ?? null
          entry.gender     = (p.gender ?? null) as 'male' | 'female' | null
        }
      }
    }

    // Sort: scheduled first → unscheduled → on-leave last; alphabetical within each group
    const rank = (s: DayStaffEntry) => s.isOnLeave ? 2 : s.hasSchedule ? 0 : 1
    const sorted = [...entries.values()].sort((a, b) => {
      const r = rank(a) - rank(b)
      return r !== 0 ? r : a.full_name.localeCompare(b.full_name)
    })

    setStaff(sorted)
    setVisits(visitsData)
    setLoading(false)
  }, [selectedBranchId])

  useEffect(() => {
    if (selectedBranchId === undefined) return
    loadAll(selectedDate)
  }, [selectedDate, selectedBranchId, loadAll])

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
    branches,
    selectedBranchId,
    setSelectedBranchId,
    loadAll,
    handleStatusChange,
    handleDelete,
    handleLeaveAction,
  }
}
