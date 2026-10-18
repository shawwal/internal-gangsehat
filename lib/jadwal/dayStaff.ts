import type { DayStaffEntry } from '@/components/jadwal/types'

// Who works on a given day, built from that weekday's schedules, active
// schedule_overrides and leave. Pure, so the Jadwal Harian grid
// (hooks/useJadwalHarian.ts) and online booking availability
// (lib/onlineBooking/availability.ts) apply exactly the same rules.

/** Directors and sport massage therapists (own jadwal) never get a column. */
export const HIDDEN_ROLES = ['director', 'sport_massage_therapist']

export interface StaffProfileJoin {
  full_name?: string | null
  nickname?: string | null
  avatar_url?: string | null
  gender?: string | null
  role?: string | null
  branch_id?: string | null
}

export interface ScheduleRow {
  staff_id: string
  branch_id: string | null
  shift: string
  jam_mulai: string | null
  jam_selesai: string | null
  internal_profiles?: StaffProfileJoin | null
}

export interface OverrideRow extends ScheduleRow {
  id: string
  hari: string
}

export interface LeaveRow {
  id: string
  staff_id: string
  reason: string | null
  status: string
  start_date: string
  end_date: string
}

export interface BuildDayStaffInput {
  /** toHariIndonesia(date) */
  hari: string
  /** null = all branches */
  branchId: string | null
  /** schedules for that hari, status AKTIF, week_group in (weekGroup, SEMUA) */
  schedules: ScheduleRow[]
  /** active overrides covering the date */
  overrides: OverrideRow[]
  /** approved + pending leave covering the date */
  leaves: LeaveRow[]
}

/** Scheduled staff for the day (regular schedules + overrides), keyed by staff id. */
export function buildScheduledStaff({ hari, branchId, schedules, overrides, leaves }: BuildDayStaffInput) {
  const isHidden = (row: { internal_profiles?: StaffProfileJoin | null }) =>
    HIDDEN_ROLES.includes(row.internal_profiles?.role ?? '')
  const inSelectedBranch = (id: string | null) => !branchId || id === branchId

  const approvedLeave = new Map<string, string>()
  const pendingLeave = new Map<string, DayStaffEntry['pendingLeave']>()
  for (const l of leaves) {
    if (l.status === 'approved') {
      approvedLeave.set(l.staff_id, l.reason ?? '')
    } else if (l.status === 'pending' && !pendingLeave.has(l.staff_id)) {
      pendingLeave.set(l.staff_id, { id: l.id, reason: l.reason ?? '', start_date: l.start_date, end_date: l.end_date })
    }
  }

  // Override targeting today's hari at this branch → staff appears with override hours.
  // Override targeting another day or branch → regular schedule is suppressed today.
  const overrideForToday = new Map<string, OverrideRow>()
  const suppressedToday = new Set<string>()
  for (const ov of overrides) {
    if (isHidden(ov)) continue
    if (ov.hari === hari && inSelectedBranch(ov.branch_id ?? null)) overrideForToday.set(ov.staff_id, ov)
    else suppressedToday.add(ov.staff_id)
  }

  const toEntry = (row: ScheduleRow, ov: OverrideRow | undefined, branch: string | null): DayStaffEntry => {
    const p = row.internal_profiles
    return {
      staff_id:     row.staff_id,
      full_name:    p?.full_name ?? 'Unknown',
      nickname:     p?.nickname ?? null,
      avatar_url:   p?.avatar_url ?? null,
      branch_id:    branch,
      gender:       (p?.gender ?? null) as 'male' | 'female' | null,
      shift:        ov?.shift ?? row.shift,
      jam_mulai:    (ov?.jam_mulai ?? row.jam_mulai)?.slice(0, 5) ?? '08:00',
      jam_selesai:  (ov?.jam_selesai ?? row.jam_selesai)?.slice(0, 5) ?? '17:00',
      isOnLeave:    approvedLeave.has(row.staff_id),
      leaveReason:  approvedLeave.get(row.staff_id) ?? null,
      hasSchedule:  true,
      pendingLeave: pendingLeave.get(row.staff_id) ?? null,
      isOverride:   !!ov,
      overrideId:   ov?.id ?? null,
    }
  }

  const entries = new Map<string, DayStaffEntry>()
  for (const row of schedules) {
    const sid = row.staff_id
    if (entries.has(sid) || isHidden(row)) continue
    const ov = overrideForToday.get(sid)
    if (!ov && suppressedToday.has(sid)) continue
    // A regular schedule counts at the staff's home branch; the row's own
    // branch_id is only a fallback for staff without one. Covering a shift at
    // another branch goes through schedule_overrides instead.
    const homeBranch = row.internal_profiles?.branch_id ?? row.branch_id ?? null
    if (!ov && !inSelectedBranch(homeBranch)) continue
    entries.set(sid, toEntry(row, ov, ov?.branch_id ?? homeBranch))
  }

  // Staff who appear only via an override (regular schedule on another day).
  for (const [sid, ov] of overrideForToday) {
    if (entries.has(sid)) continue
    entries.set(sid, toEntry(ov, ov, ov.branch_id ?? null))
  }

  return { entries, approvedLeave, pendingLeave }
}

const parseHour = (t: string) => parseInt(t.split(':')[0], 10)

/** Grid rule: a staff member can take hour h when in shift and not on leave. */
export function isInShift(entry: DayStaffEntry, hour: number): boolean {
  return entry.hasSchedule && !entry.isOnLeave
    && parseHour(entry.jam_mulai) <= hour && hour < parseHour(entry.jam_selesai)
}
