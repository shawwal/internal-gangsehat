// Clinic shifts, in day order. MIDDLE (migration 100) sits between PAGI and SORE.
export const SHIFTS = ['PAGI', 'MIDDLE', 'SORE'] as const
export type Shift = (typeof SHIFTS)[number]

export const SHIFT_LABEL: Record<Shift, string> = {
  PAGI: 'Pagi',
  MIDDLE: 'Middle',
  SORE: 'Sore',
}

/**
 * Where each shift starts on the daily grid, derived from the branch's active
 * schedule_slots: the earliest SORE slot hour (default 14) and the earliest
 * MIDDLE slot hour (null when the branch has no Middle slots).
 */
export interface ShiftDividers {
  middle: number | null
  sore: number
}

export function dividersFromSlots(slots: { shift: string; slot_time: string }[] | null): ShiftDividers {
  const hoursOf = (shift: Shift) =>
    (slots ?? []).filter((s) => s.shift === shift).map((s) => parseInt(s.slot_time.split(':')[0], 10))
  const sore = hoursOf('SORE')
  const middle = hoursOf('MIDDLE')
  return {
    sore: sore.length ? Math.min(...sore) : 14,
    middle: middle.length ? Math.min(...middle) : null,
  }
}

export function shiftForHour(hour: number, d: ShiftDividers): Shift {
  if (hour >= d.sore) return 'SORE'
  if (d.middle !== null && hour >= d.middle) return 'MIDDLE'
  return 'PAGI'
}

export type ShiftFilter = 'all' | 'pagi' | 'middle' | 'sore'

/** [start, end) hour range a shift filter covers on the grid. */
function filterRange(filter: Exclude<ShiftFilter, 'all'>, d: ShiftDividers): [number, number] {
  if (filter === 'pagi') return [0, d.middle ?? d.sore]
  if (filter === 'middle') return d.middle === null ? [0, 0] : [d.middle, d.sore]
  return [d.sore, 24]
}

export function hourInFilter(hour: number, filter: ShiftFilter, d: ShiftDividers): boolean {
  if (filter === 'all') return true
  const [lo, hi] = filterRange(filter, d)
  return hour >= lo && hour < hi
}

/** Does a working-hours range (jam_mulai → jam_selesai) overlap the filtered shift? */
export function rangeInFilter(start: number, end: number, filter: ShiftFilter, d: ShiftDividers): boolean {
  if (filter === 'all') return true
  const [lo, hi] = filterRange(filter, d)
  return start < hi && end > lo
}
