// AUTO INS replacement: derive per-staff activity counts from patient_visits.
// Pure — the server action does the querying and hands rows in.

import type { ActivityType } from './types'

export interface VisitForPayroll {
  id: string
  attending_staff_id: string | null
  service_type: string | null
  layanan_id: string | null
  visit_date: string
  kehadiran: 'HADIR' | 'TIDAK HADIR' | null
  package_id: string | null
}

/**
 * Same convention as the performance dashboards (components/performance/utils
 * isAttended): explicit HADIR counts; an unmarked visit counts only once its
 * date has passed.
 */
export function visitAttended(v: Pick<VisitForPayroll, 'kehadiran' | 'visit_date'>, todayISO: string): boolean {
  if (v.kehadiran === 'HADIR') return true
  return v.kehadiran == null && v.visit_date < todayISO
}

function matchesType(t: ActivityType, v: VisitForPayroll): boolean {
  if (!v.service_type || !t.source_service_types.includes(v.service_type)) return false
  if (t.source_layanan_ids.length > 0) return !!v.layanan_id && t.source_layanan_ids.includes(v.layanan_id)
  return true
}

/**
 * @param periodVisits      visits dated inside the period
 * @param firstPackageVisit earliest attended visit of each package seen in the period
 *                          (may lie before the period — then the sale belongs to an earlier period)
 */
export function computeAutoActivity(params: {
  types: ActivityType[]
  periodVisits: VisitForPayroll[]
  firstPackageVisit: Map<string, VisitForPayroll>
  staffIds: string[]
  start: string
  end: string
  todayISO: string
}): Record<string, Record<string, number>> {
  const { types, periodVisits, firstPackageVisit, staffIds, start, end, todayISO } = params
  const staff = new Set(staffIds)
  const out: Record<string, Record<string, number>> = {}
  const bump = (staffId: string, code: string) => {
    out[staffId] ??= {}
    out[staffId][code] = (out[staffId][code] ?? 0) + 1
  }

  const attended = periodVisits.filter((v) => v.attending_staff_id && staff.has(v.attending_staff_id) && visitAttended(v, todayISO))

  for (const t of types) {
    if (!t.is_active || t.count_mode === 'manual' || t.source_service_types.length === 0) continue
    if (t.count_mode === 'session') {
      for (const v of attended) if (matchesType(t, v)) bump(v.attending_staff_id!, t.code)
      continue
    }
    // package: one sale per package, credited to whoever ran its first attended
    // session, in the period that session falls in.
    const counted = new Set<string>()
    for (const v of attended) {
      if (!matchesType(t, v)) continue
      if (!v.package_id) {
        bump(v.attending_staff_id!, t.code) // legacy visit without a package row
        continue
      }
      if (counted.has(v.package_id)) continue
      counted.add(v.package_id)
      const first = firstPackageVisit.get(v.package_id) ?? v
      if (first.visit_date < start || first.visit_date > end) continue
      if (!first.attending_staff_id || !staff.has(first.attending_staff_id)) continue
      bump(first.attending_staff_id, t.code)
    }
  }
  return out
}
