// AUTO INS replacement: derive per-staff activity counts from patient_visits.
// Pure — the server action does the querying and hands rows in.

import type { ActivityType } from './types'
import { visitAttended } from '@/lib/metrics/achievement'

export { visitAttended }

export interface VisitForPayroll {
  id: string
  patient_id?: string
  attending_staff_id: string | null
  service_type: string | null
  layanan_id: string | null
  visit_date: string
  kehadiran: 'HADIR' | 'TIDAK HADIR' | null
  package_id: string | null
  status?: string | null
  diagnosis?: string | null
  treatment?: string | null
  regio?: string | null
}

/** Columns to select from patient_visits for VisitForPayroll rows. */
export const VISIT_FOR_PAYROLL_COLUMNS =
  'id, patient_id, attending_staff_id, service_type, layanan_id, visit_date, kehadiran, package_id, status, diagnosis, treatment, regio'

function matchesType(t: ActivityType, v: VisitForPayroll): boolean {
  if (!v.service_type || !t.source_service_types.includes(v.service_type)) return false
  if (t.source_layanan_ids.length > 0) return !!v.layanan_id && t.source_layanan_ids.includes(v.layanan_id)
  return true
}

/** One counted unit: +1 on `code` for `staff_id`, from `visit`. */
export interface PayrollActivityHit {
  staff_id: string
  code: string
  visit: VisitForPayroll
}

/**
 * Every counted unit. Session mode counts each attended visit — the same rule
 * as Target Progress "Kunjungan" (lib/metrics/achievement.ts), no longer gated
 * on a complete medical record — so the activity columns reconcile with it.
 *
 * @param periodVisits      visits dated inside the period
 * @param firstPackageVisit earliest attended visit of each package seen in the period
 *                          (may lie before the period — then the sale belongs to an earlier period)
 */
export function payrollActivityHits(params: {
  types: ActivityType[]
  periodVisits: VisitForPayroll[]
  firstPackageVisit: Map<string, VisitForPayroll>
  staffIds: string[]
  start: string
  end: string
  todayISO: string
}): PayrollActivityHit[] {
  const { types, periodVisits, firstPackageVisit, staffIds, start, end, todayISO } = params
  const staff = new Set(staffIds)
  const hits: PayrollActivityHit[] = []
  const bump = (staffId: string, code: string, visit: VisitForPayroll) => { hits.push({ staff_id: staffId, code, visit }) }

  const attended = periodVisits.filter((v) => v.attending_staff_id && staff.has(v.attending_staff_id) && visitAttended(v, todayISO))

  for (const t of types) {
    if (!t.is_active || t.count_mode === 'manual' || t.source_service_types.length === 0) continue
    if (t.count_mode === 'session') {
      for (const v of attended) if (matchesType(t, v)) bump(v.attending_staff_id!, t.code, v)
      continue
    }
    // package: one sale per package, credited to whoever ran its first attended
    // session, in the period that session falls in.
    const counted = new Set<string>()
    for (const v of attended) {
      if (!matchesType(t, v)) continue
      if (!v.package_id) {
        bump(v.attending_staff_id!, t.code, v) // legacy visit without a package row
        continue
      }
      if (counted.has(v.package_id)) continue
      counted.add(v.package_id)
      const first = firstPackageVisit.get(v.package_id) ?? v
      if (first.visit_date < start || first.visit_date > end) continue
      if (!first.attending_staff_id || !staff.has(first.attending_staff_id)) continue
      bump(first.attending_staff_id, t.code, first)
    }
  }
  return hits
}

export function computeAutoActivity(params: Parameters<typeof payrollActivityHits>[0]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {}
  for (const h of payrollActivityHits(params)) {
    out[h.staff_id] ??= {}
    out[h.staff_id][h.code] = (out[h.staff_id][h.code] ?? 0) + 1
  }
  return out
}
