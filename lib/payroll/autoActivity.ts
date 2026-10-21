// AUTO INS replacement: derive per-staff activity counts from patient_visits
// (clinic sessions) and transactions (home-visit sales).
// Pure — the server action does the querying and hands rows in.

import type { ActivityType } from './types'
import { visitAttended, type Purchase, type SaleTx } from '@/lib/metrics/achievement'

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
  /** Record form completed (Sudah Ditangani / Diperiksa) — lib/metrics/achievementData withRecordStatus. */
  record_complete: boolean
}

/** Columns to select from patient_visits for VisitForPayroll rows (record_complete is added after). */
export const VISIT_FOR_PAYROLL_COLUMNS =
  'id, patient_id, attending_staff_id, service_type, layanan_id, visit_date, kehadiran, package_id, status, diagnosis, treatment, regio'

/**
 * Home-visit activities are paid per sale, not per session: they count from
 * income transactions of the matching category, credited to the transaction's
 * Fisio on the date the payment completes.
 */
export const TRANSACTION_SOURCED_SERVICE_TYPES: Record<string, string> = {
  'TA VISIT': 'TA VISIT',
  'SESI VISIT': 'SESI VISIT',
  'PAKET VISIT': 'PAKET VISIT',
}

export const isTransactionSourced = (t: ActivityType) =>
  t.source_service_types.length > 0 && t.source_service_types.every((s) => s in TRANSACTION_SOURCED_SERVICE_TYPES)

/**
 * The service a visit is paid as. A session run under a package is a package
 * session (PT) whatever service type it was booked as — same labelling as the
 * Target Progress Kunjungan list ("PAKET 1", "PAKET 2", …).
 */
export function effectiveServiceType(v: Pick<VisitForPayroll, 'service_type' | 'package_id'>): string | null {
  if (v.package_id && (v.service_type === 'SESI TERAPI' || v.service_type === 'PAKET TERAPI')) return 'PAKET TERAPI'
  return v.service_type
}

function matchesType(t: ActivityType, v: VisitForPayroll): boolean {
  const service = effectiveServiceType(v)
  if (!service || !t.source_service_types.includes(service)) return false
  if (t.source_layanan_ids.length > 0) return !!v.layanan_id && t.source_layanan_ids.includes(v.layanan_id)
  return true
}

/** One counted unit: +1 on `code` for `staff_id`, from a visit or a transaction. */
export interface PayrollActivityHit {
  staff_id: string
  code: string
  date: string
  patient_id: string | null
  label: string | null
  /** visit id or transaction id */
  ref_id: string
}

/** A valid home-visit sale (saleIssues empty) with its whole purchase. */
export interface PayrollSale {
  tx: SaleTx
  purchase: Purchase
}

/**
 * The payment that completes a sale and its date: a lone LUNAS payment, or —
 * for a package paid in instalments — the payment that brings the total to the
 * price (LUNAS / PELUNASAN). Null while anything is still owed.
 */
function completedPayment(s: PayrollSale): SaleTx | null {
  if (s.purchase.rows.length === 1) return s.tx.payment_status === 'LUNAS' ? s.tx : null
  const c = s.purchase.completing
  return c && c.receipt_url ? c : null
}

/**
 * Every counted unit. Session mode counts each attended visit with a completed
 * record — the Target Progress "Kunjungan" rule (lib/metrics/achievement.ts) —
 * so the activity columns reconcile with it. Home-visit types count completed
 * sales (`sales`) instead of sessions.
 *
 * @param periodVisits      visits dated inside the period
 * @param firstPackageVisit earliest attended visit of each package seen in the period
 *                          (may lie before the period — then the sale belongs to an earlier period)
 * @param sales             valid home-visit sales whose purchase may complete inside the period
 */
export function payrollActivityHits(params: {
  types: ActivityType[]
  periodVisits: VisitForPayroll[]
  firstPackageVisit: Map<string, VisitForPayroll>
  sales: PayrollSale[]
  staffIds: string[]
  start: string
  end: string
  todayISO: string
}): PayrollActivityHit[] {
  const { types, periodVisits, firstPackageVisit, sales, staffIds, start, end, todayISO } = params
  const staff = new Set(staffIds)
  const hits: PayrollActivityHit[] = []
  const bump = (staffId: string, code: string, visit: VisitForPayroll) => {
    hits.push({ staff_id: staffId, code, date: visit.visit_date, patient_id: visit.patient_id ?? null, label: effectiveServiceType(visit), ref_id: visit.id })
  }

  const attended = periodVisits.filter((v) =>
    v.attending_staff_id && staff.has(v.attending_staff_id) && v.record_complete && visitAttended(v, todayISO))

  for (const t of types) {
    if (!t.is_active || t.count_mode === 'manual' || t.source_service_types.length === 0) continue
    if (isTransactionSourced(t)) {
      const categories = new Set(t.source_service_types.map((s) => TRANSACTION_SOURCED_SERVICE_TYPES[s]))
      for (const s of sales) {
        if (!categories.has(s.tx.category) || !s.tx.staff_id || !staff.has(s.tx.staff_id)) continue
        const paid = completedPayment(s)
        if (!paid || paid.transaction_date < start || paid.transaction_date > end) continue
        hits.push({ staff_id: s.tx.staff_id, code: t.code, date: paid.transaction_date, patient_id: s.tx.patient_id, label: s.tx.category, ref_id: s.tx.id })
      }
      continue
    }
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

/**
 * Attended visits whose record is still open, per staff + activity code — the
 * "belum ditangani" sessions that would count once the therapist completes them.
 */
export function pendingRecordCounts(params: {
  types: ActivityType[]
  periodVisits: VisitForPayroll[]
  staffIds: string[]
  todayISO: string
}): Record<string, Record<string, number>> {
  const staff = new Set(params.staffIds)
  const out: Record<string, Record<string, number>> = {}
  const open = params.periodVisits.filter((v) =>
    v.attending_staff_id && staff.has(v.attending_staff_id) && !v.record_complete && visitAttended(v, params.todayISO))
  for (const t of params.types) {
    if (!t.is_active || t.count_mode !== 'session' || isTransactionSourced(t)) continue
    for (const v of open) {
      if (!matchesType(t, v)) continue
      const row = (out[v.attending_staff_id!] ??= {})
      row[t.code] = (row[t.code] ?? 0) + 1
    }
  }
  return out
}

export function computeAutoActivity(params: Parameters<typeof payrollActivityHits>[0]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {}
  for (const h of payrollActivityHits(params)) {
    out[h.staff_id] ??= {}
    out[h.staff_id][h.code] = (out[h.staff_id][h.code] ?? 0) + 1
  }
  return out
}
