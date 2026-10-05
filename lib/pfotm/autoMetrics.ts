// Auto metrics for PFOTM (replaces the Kunjungan / Keuangan / Rujukan SM imports
// and the Hadir/Terlambat/Alfa columns typed from the ABS sheet). Pure module.

import { visitAttended, type VisitForPayroll } from '@/lib/payroll/autoActivity'

export const CLINIC_VISIT_TYPES = ['TERAPI AWAL', 'SESI TERAPI', 'PAKET TERAPI']
export const HOME_SESSION_TYPES = ['TA VISIT', 'SESI VISIT']

export interface AttendanceForPfotm {
  staff_id: string
  status: 'present' | 'absent' | 'late' | 'leave' | 'sick' | 'izin'
}

export interface PackageInfo {
  id: string
  jenis_paket: string | null    // P1 | P2 | (future P3)
  total_sessions: number
}

export function computePfotmAutoMetrics(params: {
  staffIds: string[]
  start: string
  end: string
  todayISO: string
  attendance: AttendanceForPfotm[]
  periodVisits: VisitForPayroll[]
  /** earliest attended visit of each package seen in the period */
  firstPackageVisit: Map<string, VisitForPayroll>
  packages: Map<string, PackageInfo>
  /** referred patients: referring staff + date of the patient's first visit (or registration) */
  referrals: { staff_id: string; first_date: string }[]
}): Record<string, Record<string, number>> {
  const { staffIds, start, end, todayISO } = params
  const out: Record<string, Record<string, number>> = {}
  for (const id of staffIds) {
    out[id] = { hadir: 0, terlambat: 0, alfa: 0, kunjungan: 0, paket_1: 0, paket_2: 0, ta_sesi_visit: 0, paket_visit: 0, rujukan_sm: 0 }
  }
  const bump = (id: string | null, key: string) => { if (id && out[id]) out[id][key]++ }

  for (const a of params.attendance) {
    if (a.status === 'present') bump(a.staff_id, 'hadir')
    else if (a.status === 'late') { bump(a.staff_id, 'hadir'); bump(a.staff_id, 'terlambat') }
    else if (a.status === 'absent') bump(a.staff_id, 'alfa')
  }

  const countedPackages = new Set<string>()
  for (const v of params.periodVisits) {
    if (!visitAttended(v, todayISO) || !v.service_type) continue
    if (CLINIC_VISIT_TYPES.includes(v.service_type)) bump(v.attending_staff_id, 'kunjungan')
    if (HOME_SESSION_TYPES.includes(v.service_type)) bump(v.attending_staff_id, 'ta_sesi_visit')

    // Package sales: once per package, credited in the period of its first attended session.
    if ((v.service_type === 'PAKET TERAPI' || v.service_type === 'PAKET VISIT') && v.package_id && !countedPackages.has(v.package_id)) {
      countedPackages.add(v.package_id)
      const first = params.firstPackageVisit.get(v.package_id) ?? v
      if (first.visit_date < start || first.visit_date > end) continue
      if (v.service_type === 'PAKET VISIT') { bump(first.attending_staff_id, 'paket_visit'); continue }
      const pkg = params.packages.get(v.package_id)
      const tier = pkg?.jenis_paket ?? (pkg && pkg.total_sessions >= 10 ? 'P2' : 'P1')
      bump(first.attending_staff_id, tier === 'P2' ? 'paket_2' : 'paket_1')
    }
  }

  for (const r of params.referrals) {
    if (r.first_date >= start && r.first_date <= end) bump(r.staff_id, 'rujukan_sm')
  }
  return out
}
