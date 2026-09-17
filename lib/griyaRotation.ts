// Griya Anak's daily therapist rotation resolver. Pure functions, safe to import
// from both client components (rendering the grid) and server actions (deciding
// who a freshly-marked visit should be attributed to) — see components/griya/resolve.ts
// and app/actions/griyaJadwal.ts.

export type RotationDiscipline = 'FISIOTERAPI' | 'TERAPI_WICARA' | 'TERAPI_PERILAKU' | 'PSIKOLOG'
export type RotationHari = 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU' | 'AHAD'

export interface RotationTherapist {
  therapist_id: string
  discipline: RotationDiscipline
  display_order: number
  is_active: boolean
}

export interface RotationSchedule {
  staff_id: string
  hari: string
  jam_mulai: string   // 'HH:MM' or 'HH:MM:SS'
  jam_selesai: string
  status: string       // 'AKTIF' | 'OFF'
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10))
  return h * 60 + (m || 0)
}

/** Is a therapist working (per their rolling `schedules` rows) at `hari` covering `hour`?
 *  Used to grey out grid columns. An explicit OFF row for that day blocks; no row at all
 *  (nothing configured either way) is unknown and doesn't block. */
export function isTherapistOn(
  schedules: RotationSchedule[], therapistId: string, hari: string, hour: string,
): boolean {
  const rows = schedules.filter((r) => r.staff_id === therapistId && r.hari === hari)
  if (rows.length === 0) return true // no schedule row at all → don't block (unknown)
  const target = toMinutes(hour)
  return rows.some((r) => r.status === 'AKTIF' && toMinutes(r.jam_mulai) <= target && target < toMinutes(r.jam_selesai))
}

/**
 * Resolves which therapist should cover a given discipline+hari+slot_time, based
 * on who's actually on duty that weekday (per `schedules`) among the branch's
 * active therapists of that discipline. Ties break by `display_order` (the same
 * ordering admins control via "Kelola Kolom Terapis") — lowest wins. Returns
 * null when nobody of that discipline is on duty ("Unassigned").
 *
 * If `slot.therapist_id` is set (a pin made from jadwal harian, see
 * AddMasterScheduleDialog), it wins over rotation as long as that therapist is
 * still active, of the right discipline, and on duty at that time — otherwise
 * it silently falls back to rotation instead of stranding the slot.
 */
export function resolveTherapistForSlot(
  slot: { discipline: RotationDiscipline; hari: string; slot_time: string; therapist_id?: string | null },
  therapists: RotationTherapist[],
  schedules: RotationSchedule[],
): string | null {
  if (slot.therapist_id) {
    const pinned = therapists.find((t) => t.therapist_id === slot.therapist_id && t.is_active && t.discipline === slot.discipline)
    if (pinned && isTherapistOnDuty(schedules, pinned.therapist_id, slot.hari, slot.slot_time)) {
      return pinned.therapist_id
    }
  }
  const candidates = therapists
    .filter((t) => t.is_active && t.discipline === slot.discipline)
    .filter((t) => isTherapistOnDuty(schedules, t.therapist_id, slot.hari, slot.slot_time))
    .sort((a, b) => a.display_order - b.display_order)
  return candidates[0]?.therapist_id ?? null
}

// isTherapistOn above answers "don't block" (true) when there's no schedule row at
// all — appropriate for greying out grid columns, but rotation resolution should
// NOT auto-assign someone with an unknown schedule. Require an explicit AKTIF row
// that covers the time.
function isTherapistOnDuty(schedules: RotationSchedule[], therapistId: string, hari: string, hour: string): boolean {
  const rows = schedules.filter((r) => r.staff_id === therapistId && r.hari === hari && r.status === 'AKTIF')
  const target = toMinutes(hour)
  return rows.some((r) => toMinutes(r.jam_mulai) <= target && target < toMinutes(r.jam_selesai))
}
