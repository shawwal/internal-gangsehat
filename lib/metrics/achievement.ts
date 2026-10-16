// One definition of "what counts" for every achievement number: Target Progress
// (branch-wide), PFOTM and Payroll (per therapist). Pure — callers query with
// the constants below and pass rows in, so the per-therapist columns add up to
// the Target Progress branch totals for the same date window.

/** Visit statuses that can count (a scheduled visit counts once attended). */
export const KUNJUNGAN_VISIT_STATUSES = ['scheduled', 'completed'] as const

/** PostgREST `.or()` filter: sport massage is tracked separately — not a kunjungan. */
export const KUNJUNGAN_SERVICE_FILTER = 'service_type.is.null,service_type.neq."SPORT MASSAGE"'

/**
 * Income transactions that count as one sale. PELUNASAN is left out on purpose:
 * a DP + PELUNASAN pair is one sale.
 */
export const SALE_PAYMENT_STATUSES = ['LUNAS', 'DP'] as const

export interface VisitForAchievement {
  visit_date: string
  kehadiran: 'HADIR' | 'TIDAK HADIR' | null
  status?: string | null
  service_type?: string | null
}

/**
 * Explicit HADIR counts; an unmarked visit counts only once its date has
 * passed (same convention as the performance dashboards).
 */
export function visitAttended(v: Pick<VisitForAchievement, 'kehadiran' | 'visit_date'>, todayISO: string): boolean {
  if (v.kehadiran === 'HADIR') return true
  return v.kehadiran == null && v.visit_date < todayISO
}

/** A "Kunjungan": an attended, non-cancelled, non-sport-massage visit. */
export function countsAsKunjungan(v: VisitForAchievement, todayISO: string): boolean {
  if (v.status != null && !(KUNJUNGAN_VISIT_STATUSES as readonly string[]).includes(v.status)) return false
  if (v.service_type === 'SPORT MASSAGE') return false
  return visitAttended(v, todayISO)
}

/** Every ISO date from start to end inclusive. */
export function datesBetween(start: string, end: string): string[] {
  const out: string[] = []
  const d = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  while (d <= last) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

/** One line in a "which patients make up this number" list. */
export interface MetricDetailRow {
  date: string
  patientName: string
  /** service type / transaction category */
  label: string | null
}

export interface MetricDetail {
  rows: MetricDetailRow[]
  /** auto-counted value (= rows.length) */
  auto: number
  /** manual correction, when one is set */
  override: number | null
}
