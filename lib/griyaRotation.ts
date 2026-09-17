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
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10))
  return h * 60 + (m || 0)
}

/** Is a therapist working (per their rolling `schedules` rows) at `hari` covering `hour`? */
export function isTherapistOn(
  schedules: RotationSchedule[], therapistId: string, hari: string, hour: string,
): boolean {
  const rows = schedules.filter((r) => r.staff_id === therapistId && r.hari === hari)
  if (rows.length === 0) return true // no schedule row → don't block (unknown)
  const target = toMinutes(hour)
  return rows.some((r) => toMinutes(r.jam_mulai) <= target && target < toMinutes(r.jam_selesai))
}

/**
 * Resolves which therapist should cover a given discipline+hari+slot_time, based
 * on who's actually on duty that weekday (per `schedules`) among the branch's
 * active therapists of that discipline. Ties break by `display_order` (the same
 * ordering admins control via "Kelola Kolom Terapis") — lowest wins. Returns
 * null when nobody of that discipline is on duty ("Unassigned").
 */
export function resolveTherapistForSlot(
  slot: { discipline: RotationDiscipline; hari: string; slot_time: string },
  therapists: RotationTherapist[],
  schedules: RotationSchedule[],
): string | null {
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
  const rows = schedules.filter((r) => r.staff_id === therapistId && r.hari === hari)
  const target = toMinutes(hour)
  return rows.some((r) => toMinutes(r.jam_mulai) <= target && target < toMinutes(r.jam_selesai))
}
