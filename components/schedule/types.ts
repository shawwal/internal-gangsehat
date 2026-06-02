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
}

export interface BranchOption {
  id: string
  name: string
}

export interface ScheduleForm {
  staff_id: string
  branch_id: string
  hari: string
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
