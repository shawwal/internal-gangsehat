import type { GriyaWeek, GriyaSlot, GriyaWeekVisit, GriyaTherapist, Hari } from '@/app/actions/griyaJadwal'
import { hariOf } from './constants'

export type CellState = 'scheduled' | 'hadir' | 'izin' | 'alpa' | 'moved-out' | 'adhoc'

export interface ResolvedCell {
  key: string                 // `${therapistId}|${hour}`
  therapistId: string
  hour: string                // 'HH:MM'
  state: CellState
  slot: GriyaSlot | null
  visit: GriyaWeekVisit | null
  studentName: string
  reason: string | null
}

function deriveState(v: GriyaWeekVisit): CellState {
  if (v.status === 'completed' || v.kehadiran === 'HADIR') return 'hadir'
  if (v.status === 'no_show') return 'alpa'
  if (v.status === 'cancelled') return 'izin'
  return 'scheduled'
}

/** Builds the cell map for one calendar day of the loaded week. */
export function resolveDay(week: GriyaWeek, dateIso: string): Map<string, ResolvedCell> {
  const hari: Hari = hariOf(new Date(dateIso + 'T00:00:00'))
  const cells = new Map<string, ResolvedCell>()

  const visitsToday = week.visits.filter((v) => v.visit_date === dateIso)
  const bySlot = new Map<string, GriyaWeekVisit>()
  for (const v of visitsToday) if (v.griya_slot_id) bySlot.set(v.griya_slot_id, v)

  // 1. recurring slots for this weekday
  for (const s of week.slots) {
    if (s.hari !== hari) continue
    const v = bySlot.get(s.id) ?? null
    const homeKey = `${s.therapist_id}|${s.slot_time}`
    const placedKey = v && v.attending_staff_id
      ? `${v.attending_staff_id}|${v.visit_time ?? s.slot_time}`
      : homeKey

    cells.set(placedKey, {
      key: placedKey,
      therapistId: v?.attending_staff_id ?? s.therapist_id,
      hour: v?.visit_time ?? s.slot_time,
      state: v ? deriveState(v) : 'scheduled',
      slot: s,
      visit: v,
      studentName: s.patient_name,
      reason: v && v.status === 'cancelled' ? (v.notes ?? null) : null,
    })

    if (placedKey !== homeKey) {
      cells.set(homeKey, {
        key: homeKey, therapistId: s.therapist_id, hour: s.slot_time,
        state: 'moved-out', slot: s, visit: null, studentName: s.patient_name, reason: null,
      })
    }
  }

  // 2. substitutes / ad-hoc (visits with no recurring slot)
  for (const v of visitsToday) {
    if (v.griya_slot_id || !v.attending_staff_id) continue
    const key = `${v.attending_staff_id}|${v.visit_time ?? ''}`
    const existing = cells.get(key)
    if (!existing || existing.state === 'moved-out' || existing.state === 'izin' || existing.state === 'alpa') {
      cells.set(key, {
        key, therapistId: v.attending_staff_id, hour: v.visit_time ?? '',
        state: 'adhoc', slot: null, visit: v, studentName: v.patient_name, reason: v.notes ?? null,
      })
    }
  }

  return cells
}

/** Is a therapist working (per `schedules`) at `hari` covering `hour`? */
export function isTherapistOn(
  week: GriyaWeek, therapistId: string, hari: Hari, hour: string,
): boolean {
  const rows = week.schedules.filter((r) => r.staff_id === therapistId && r.hari === hari)
  if (rows.length === 0) return true // no schedule row → don't block (unknown)
  const h = parseInt(hour.slice(0, 2), 10)
  return rows.some((r) => parseInt(r.jam_mulai.slice(0, 2), 10) <= h && h < parseInt(r.jam_selesai.slice(0, 2), 10))
}

export function therapistColumns(therapists: GriyaTherapist[]) {
  return therapists
    .filter((t) => t.is_active)
    .sort((a, b) => a.display_order - b.display_order)
}
