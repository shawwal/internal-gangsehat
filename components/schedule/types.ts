export interface ScheduleRow {
  id: string
  staff_id: string
  branch_id: string | null
  hari: string
  shift: string
  jam_mulai: string
  jam_selesai: string
  status: 'AKTIF' | 'OFF'
  notes: string | null
  internal_profiles: { full_name: string } | null
  branches: { name: string } | null
}

export interface StaffOption {
  id: string
  full_name: string
  branch_id?: string | null
  avatar_url?: string | null
}

export interface BranchOption {
  id: string
  name: string
}

export interface ScheduleForm {
  staff_ids: string[]  // multi-staff; single-element array when editing
  branch_id: string
  hari: string[]       // multi-day selection; single element when editing
  shift: string
  jam_mulai: string
  jam_selesai: string
  status: 'AKTIF' | 'OFF'
  notes: string
}

export interface DayEntry {
  enabled: boolean
  shift: string
  jam_mulai: string
  jam_selesai: string
  status: 'AKTIF' | 'OFF'
}

export type WeeklyPattern = Record<string, DayEntry>

export interface LeaveCalendarRow {
  id: string
  start_date: string
  end_date: string
  reason: string
}

export interface AttendanceCalendarRow {
  id: string
  status: string
  notes: string | null
}

export type CalendarEffectiveStatus = 'AKTIF' | 'CUTI' | 'OFF' | 'OVERRIDE_AKTIF' | 'OVERRIDE_OFF'

export interface CalendarStaffEntry {
  staff_id: string
  full_name: string
  branch_id: string | null
  schedules_for_day: ScheduleRow[]
  leave: LeaveCalendarRow | null
  attendance: AttendanceCalendarRow | null
  effectiveStatus: CalendarEffectiveStatus
}
