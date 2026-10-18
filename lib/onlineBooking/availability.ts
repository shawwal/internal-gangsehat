import type { DayStaffEntry } from '@/components/jadwal/types'
import { isInShift } from '@/lib/jadwal/dayStaff'

// Free therapist hours for online booking. Pure: the caller loads the day's
// staff (buildScheduledStaff), slots, visits and live holds.

/** Grid fallback when a branch has no schedule_slots: 8–20, minus breaks. */
export const FALLBACK_HOURS = [8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20]

/** Minimum time between now and a bookable slot. */
export const MIN_LEAD_MINUTES = 120

export interface SlotRow { shift: string; slot_time: string }
export interface BusyRow { staff_id: string; hour: number }

export interface AvailableTherapist {
  id: string
  name: string
  nickname: string | null
  gender: 'male' | 'female' | null
  /** The therapist's own shift that day — stored on the visit (the slot row's shift can differ). */
  shift: string
}

export interface AvailableHour {
  hour: number
  shift: string
  therapists: AvailableTherapist[]
}

const toHour = (t: string) => parseInt(t.split(':')[0], 10)

/** Hours of the branch's active slots with their shift, or the fallback. */
export function branchHours(slots: SlotRow[]): { hour: number; shift: string }[] {
  if (slots.length === 0) {
    return FALLBACK_HOURS.map((hour) => ({ hour, shift: hour < 14 ? 'PAGI' : 'SORE' }))
  }
  const byHour = new Map<number, string>()
  for (const s of slots) {
    const h = toHour(s.slot_time)
    if (!byHour.has(h)) byHour.set(h, s.shift)
  }
  return [...byHour.entries()].sort((a, b) => a[0] - b[0]).map(([hour, shift]) => ({ hour, shift }))
}

/**
 * Minutes from "now" (Asia/Jakarta, UTC+7, no DST) to date + hour.
 * `date` is 'YYYY-MM-DD'.
 */
export function minutesUntil(date: string, hour: number, now: Date = new Date()): number {
  const [y, m, d] = date.split('-').map(Number)
  const slotUtcMs = Date.UTC(y, m - 1, d, hour - 7, 0, 0)
  return Math.floor((slotUtcMs - now.getTime()) / 60000)
}

export function computeAvailability(input: {
  date: string
  staff: DayStaffEntry[]
  slots: SlotRow[]
  /** non-cancelled visits + live holds for the date, any branch */
  busy: BusyRow[]
  now?: Date
}): AvailableHour[] {
  const busy = new Set(input.busy.map((b) => `${b.staff_id}:${b.hour}`))
  const result: AvailableHour[] = []
  for (const { hour, shift } of branchHours(input.slots)) {
    if (minutesUntil(input.date, hour, input.now) < MIN_LEAD_MINUTES) continue
    const therapists = input.staff
      .filter((s) => isInShift(s, hour) && !busy.has(`${s.staff_id}:${hour}`))
      .map((s) => ({ id: s.staff_id, name: s.full_name, nickname: s.nickname, gender: s.gender, shift: s.shift || shift }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'))
    if (therapists.length > 0) result.push({ hour, shift, therapists })
  }
  return result
}
