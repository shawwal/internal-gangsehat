import type { DailyVisit } from '@/app/actions/jadwal'
import type { VisitStatus } from '@/types'

export type { DailyVisit }

export interface DayStaffEntry {
  staff_id: string
  full_name: string
  branch_id: string | null
  shift: string           // 'PAGI' | 'SORE' | ''
  jam_mulai: string       // 'HH:MM'
  jam_selesai: string     // 'HH:MM'
  isOnLeave: boolean
  leaveReason: string | null
  hasSchedule: boolean    // false = unscheduled but has visits today
}

export interface AssignTarget {
  staffId: string
  staffName: string
  branchId: string | null
  hour: number     // 8..19
  date: string     // ISO yyyy-mm-dd
}

export interface VisitCardProps {
  visit: DailyVisit
  onStatusChange: (id: string, status: VisitStatus) => void
  onDelete: (id: string) => void
}

export const STATUS_LABEL: Record<VisitStatus, string> = {
  scheduled: 'Terjadwal',
  completed: 'Selesai',
  cancelled: 'Batal',
  no_show:   'Tdk Hadir',
}

export const STATUS_COLOR: Record<VisitStatus, string> = {
  scheduled: 'bg-blue-500/20 border-blue-400/50 text-blue-300',
  completed: 'bg-[#34C759]/20 border-[#34C759]/50 text-[#34C759]',
  cancelled: 'bg-destructive/20 border-destructive/50 text-destructive',
  no_show:   'bg-muted/30 border-border/40 text-muted-foreground',
}

export const STATUS_BADGE: Record<VisitStatus, string> = {
  scheduled: 'bg-blue-500/20 text-blue-300',
  completed: 'bg-[#34C759]/20 text-[#34C759]',
  cancelled: 'bg-destructive/15 text-destructive',
  no_show:   'bg-muted/40 text-muted-foreground',
}

export const GRID_START  = 8
export const GRID_END    = 21   // exclusive — slots 08:00 to 20:00
export const SLOT_H      = 80   // px per 1-hour slot
export const TIME_COL_W  = 72   // px for time gutter
export const STAFF_COL_W = 176  // px per staff column
