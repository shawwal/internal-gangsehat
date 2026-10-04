import type { GriyaWeek, GriyaSlot, GriyaWeekVisit, GriyaTherapist, Hari } from '@/app/actions/griyaJadwal'
import { hariOf, DISCIPLINES } from './constants'
import { resolveTherapistForSlot, isTherapistOn as isTherapistOnDuty } from '@/lib/griyaRotation'

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

/** Does this cell hold a live booking (a child who will actually be seen), as
 *  opposed to a freed spot — a moved-out ghost, an absence, or a cancelled
 *  one-off? Shared with the server's occupancy check (isCellOccupied in
 *  app/actions/griyaJadwal.ts) so "is this cell taken" is decided by exactly
 *  the same rule the grid renders with. */
export function isBusyCell(c: ResolvedCell): boolean {
  if (c.state === 'scheduled' || c.state === 'hadir') return true
  if (c.state === 'adhoc') return !['cancelled', 'no_show'].includes(c.visit?.status ?? '')
  return false
}

/** Builds the cell map for one calendar day of the loaded week, plus any master
 *  slots that couldn't be placed because nobody of that discipline is on duty. */
export function resolveDay(week: GriyaWeek, dateIso: string): { cells: Map<string, ResolvedCell[]>; unassigned: ResolvedCell[] } {
  const hari: Hari = hariOf(new Date(dateIso + 'T00:00:00'))
  const cells = new Map<string, ResolvedCell[]>()
  const unassigned: ResolvedCell[] = []

  function push(key: string, cell: ResolvedCell) {
    const arr = cells.get(key)
    if (arr) arr.push(cell)
    else cells.set(key, [cell])
  }

  const visitsToday = week.visits.filter((v) => v.visit_date === dateIso)
  const bySlot = new Map<string, GriyaWeekVisit>()
  for (const v of visitsToday) if (v.griya_slot_id) bySlot.set(v.griya_slot_id, v)

  // 1. recurring slots for this weekday — therapist is resolved per-day from
  // whoever's rolling schedule covers this discipline+time, unless the slot pins
  // a specific therapist_id (set from jadwal harian), which wins when still valid.
  for (const s of week.slots) {
    if (s.hari !== hari) continue
    let v = bySlot.get(s.id) ?? null
    // An ended slot, or a date outside the slot's validity window, generates
    // nothing — only a visit already recorded for that date (history) is shown.
    // An untouched placeholder there (status 'scheduled', no attendance — e.g. a
    // one-week move made before the schedule was ended/replaced) isn't history:
    // rendering it showed the same child twice, next to the slot that replaced it.
    const inWindow = s.status === 'active' && dateIso >= s.start_date && !(s.end_date && dateIso > s.end_date)
    if (!inWindow && v && v.status === 'scheduled' && !v.kehadiran) v = null
    if (!v && !inWindow) continue
    const resolvedTherapistId = resolveTherapistForSlot(
      { discipline: s.discipline, hari: s.hari, slot_time: s.slot_time, therapist_id: s.therapist_id },
      week.therapists, week.schedules,
    )

    if (v && v.attending_staff_id) {
      // An explicit override exists for this date (this-week move/attendance) — it wins.
      const placedKey = `${v.attending_staff_id}|${v.visit_time ?? s.slot_time}`
      push(placedKey, {
        key: placedKey, therapistId: v.attending_staff_id, hour: v.visit_time ?? s.slot_time,
        state: deriveState(v), slot: s, visit: v, studentName: s.patient_name,
        reason: v.status === 'cancelled' ? (v.notes ?? null) : null,
      })
      // Ghost the "home" cell (where rotation would've put it today) if the override moved it elsewhere
      // — only while the schedule is actually in effect that day, otherwise there's no home cell.
      if (resolvedTherapistId && inWindow) {
        const homeKey = `${resolvedTherapistId}|${s.slot_time}`
        if (homeKey !== placedKey) {
          push(homeKey, {
            key: homeKey, therapistId: resolvedTherapistId, hour: s.slot_time,
            state: 'moved-out', slot: s, visit: null, studentName: s.patient_name, reason: null,
          })
        }
      }
      continue
    }

    if (!resolvedTherapistId) {
      // Nobody of this discipline is on duty today — surface it, don't place in a column.
      unassigned.push({
        key: `unassigned:${s.id}`, therapistId: '', hour: s.slot_time,
        state: 'scheduled', slot: s, visit: v, studentName: s.patient_name, reason: null,
      })
      continue
    }

    const homeKey = `${resolvedTherapistId}|${s.slot_time}`
    push(homeKey, {
      key: homeKey, therapistId: resolvedTherapistId, hour: s.slot_time,
      state: v ? deriveState(v) : 'scheduled', slot: s, visit: v, studentName: s.patient_name,
      reason: v && v.status === 'cancelled' ? (v.notes ?? null) : null,
    })
  }

  // 2. substitutes / ad-hoc (visits with no recurring slot). A real therapist can only
  // see one child at a given hour, so this stays a single-slot replace, guarded against
  // clobbering a genuinely active (non-freed) cell already at that key.
  for (const v of visitsToday) {
    if (v.griya_slot_id || !v.attending_staff_id) continue
    const key = `${v.attending_staff_id}|${v.visit_time ?? ''}`
    const existing = cells.get(key)
    // A cancelled one-off frees the cell too — a new booking there must replace it,
    // not be hidden behind it (the server accepts that booking, see isCellOccupied).
    const blocked = existing?.some(isBusyCell)
    if (!blocked) {
      cells.set(key, [{
        key, therapistId: v.attending_staff_id, hour: v.visit_time ?? '',
        state: 'adhoc', slot: null, visit: v, studentName: v.patient_name, reason: v.notes ?? null,
      }])
    }
  }

  return { cells, unassigned }
}

/** Is a therapist working (per `schedules`) at `hari` covering `hour`? Used to grey
 *  out grid columns — unlike rotation resolution, an unknown schedule doesn't block. */
export function isTherapistOn(
  week: GriyaWeek, therapistId: string, hari: Hari, hour: string,
): boolean {
  return isTherapistOnDuty(week.schedules, therapistId, hari, hour)
}

export function therapistColumns(therapists: GriyaTherapist[]) {
  return therapists
    .filter((t) => t.is_active)
    .sort((a, b) =>
      DISCIPLINES.indexOf(a.discipline) - DISCIPLINES.indexOf(b.discipline) ||
      a.display_order - b.display_order,
    )
}
