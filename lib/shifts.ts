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

/**
 * Grid view filter — only Pagi and Sore. The view split is fixed and no longer
 * derived from schedule_slots, so a Middle slot can't hide afternoon hours:
 * Pagi covers up to 14:00 (09–14 in practice), Sore covers 15:00 onwards.
 */
export type ShiftFilter = 'all' | 'pagi' | 'sore'
export const SHIFT_FILTERS = ['pagi', 'sore'] as const
export const VIEW_SORE_START = 15

export function isShiftFilter(v: unknown): v is ShiftFilter {
  return v === 'all' || v === 'pagi' || v === 'sore'
}

/** [start, end) hour range a shift filter covers on the grid. */
function filterRange(filter: Exclude<ShiftFilter, 'all'>): [number, number] {
  return filter === 'pagi' ? [0, VIEW_SORE_START] : [VIEW_SORE_START, 24]
}

export function hourInFilter(hour: number, filter: ShiftFilter): boolean {
  if (filter === 'all') return true
  const [lo, hi] = filterRange(filter)
  return hour >= lo && hour < hi
}

/** Does a working-hours range (jam_mulai → jam_selesai) overlap the filtered shift? */
export function rangeInFilter(start: number, end: number, filter: ShiftFilter): boolean {
  if (filter === 'all') return true
  const [lo, hi] = filterRange(filter)
  return start < hi && end > lo
}
