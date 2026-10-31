// Visit length on the schedule. patient_visits.duration_minutes NULL = one hour
// slot; Sport Massage Full Body is 90 (internal_layanan.durasi_menit, 124).

export const DEFAULT_VISIT_MINUTES = 60

export function visitMinutes(v: { duration_minutes?: number | null }): number {
  return v.duration_minutes && v.duration_minutes > 0 ? v.duration_minutes : DEFAULT_VISIT_MINUTES
}

/** 'HH:MM[:SS]' → minutes since midnight. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10))
  return h * 60 + (m || 0)
}

/** Minutes since midnight → 'HH:MM'. */
export function minutesToTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

/** '13:00' + 90 → '14:30'. */
export function endTime(hhmm: string, minutes: number): string {
  return minutesToTime(timeToMinutes(hhmm) + minutes)
}
