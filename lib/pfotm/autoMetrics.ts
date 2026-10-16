// Auto metrics for PFOTM (replaces the Kunjungan / Keuangan / Rujukan SM imports
// and the Hadir/Terlambat/Alfa columns typed from the ABS sheet). Pure module.
//
// Counting rules are shared with Target Progress (lib/metrics/achievement.ts),
// so the column sums equal the branch's Capaian for the same window. Every
// counted unit is a dated "hit", which also feeds the drill-down list and the
// daily rank chart — the count and the list can never disagree.

import { countsAsKunjungan } from '@/lib/metrics/achievement'
import type { VisitForPayroll } from '@/lib/payroll/autoActivity'

export { SALE_PAYMENT_STATUSES as SALES_PAYMENT_STATUSES } from '@/lib/metrics/achievement'

// Income categories that feed the sales columns.
export const SALES_CATEGORIES = ['PAKET KLINIK', 'TA VISIT', 'SESI VISIT', 'PAKET VISIT']

/** Metrics that come with a patient + date list (clickable in the input table). */
export const DRILLDOWN_METRICS = ['kunjungan', 'paket_1', 'paket_2', 'paket_3', 'ta_sesi_visit', 'paket_visit', 'rujukan_sm'] as const

export interface AttendanceForPfotm {
  staff_id: string
  date: string
  status: 'present' | 'absent' | 'late' | 'leave' | 'sick' | 'izin'
}

export interface PackageInfo {
  id: string
  jenis_paket: string | null    // P1 | P2 | (future P3)
  total_sessions: number
}

/** An income transaction (LUNAS/DP) already attributed to a therapist. */
export interface SaleForPfotm {
  id?: string
  staff_id: string | null
  category: string
  transaction_date?: string
  patient_id?: string | null
  /** The package bought, when the transaction links to one (PAKET KLINIK tiering). */
  package: PackageInfo | null
}

export interface PfotmReferral {
  staff_id: string
  first_date: string
  patient_id?: string
}

/** One counted unit: +1 on `key` for `staff_id`, dated. */
export interface PfotmHit {
  staff_id: string
  key: string
  date: string
  patient_id: string | null
  /** visit / transaction id */
  ref_id: string | null
  /** service type or transaction category */
  label: string | null
}

export interface PfotmAutoInput {
  staffIds: string[]
  start: string
  end: string
  todayISO: string
  attendance: AttendanceForPfotm[]
  /** visits dated inside the period */
  periodVisits: (VisitForPayroll & { patient_id?: string })[]
  /** LUNAS/DP income transactions dated inside the period */
  sales: SaleForPfotm[]
  /** referred patients: referring staff + date of the patient's first visit (or registration) */
  referrals: PfotmReferral[]
}

const EMPTY_METRICS = () => ({ hadir: 0, terlambat: 0, alfa: 0, kunjungan: 0, paket_1: 0, paket_2: 0, paket_3: 0, ta_sesi_visit: 0, paket_visit: 0, rujukan_sm: 0 })

function packageTierKey(pkg: PackageInfo | null): 'paket_1' | 'paket_2' | 'paket_3' {
  const tier = pkg?.jenis_paket ?? (pkg && pkg.total_sessions >= 10 ? 'P2' : 'P1')
  return tier === 'P3' ? 'paket_3' : tier === 'P2' ? 'paket_2' : 'paket_1'
}

/** A visit / sale that counts for the branch but isn't credited to any participant. */
export interface PfotmGapHit extends Omit<PfotmHit, 'staff_id'> {
  /** null = no Fisio on the transaction / visit; else a staff member who isn't on the board */
  staff_id: string | null
}

/** Every counted unit for the participants, in input order. */
export function pfotmHits(params: PfotmAutoInput): PfotmHit[] {
  return pfotmHitsWithGap(params).hits
}

/**
 * Same walk as `pfotmHits`, but also returns the kunjungan / sales units that
 * fall outside the participants (no Fisio, or a non-participant) — so the
 * board's Jumlah + gap equals the branch Capaian for the same window.
 */
export function pfotmHitsWithGap(params: PfotmAutoInput): { hits: PfotmHit[]; gap: PfotmGapHit[] } {
  const { start, end, todayISO } = params
  const staff = new Set(params.staffIds)
  const hits: PfotmHit[] = []
  const gap: PfotmGapHit[] = []
  const hit = (id: string | null | undefined, key: string, date: string, extra: Partial<PfotmHit> = {}, track = false) => {
    const row = { key, date, patient_id: null, ref_id: null, label: null, ...extra }
    if (id && staff.has(id)) hits.push({ ...row, staff_id: id })
    else if (track) gap.push({ ...row, staff_id: id ?? null })
  }

  for (const a of params.attendance) {
    if (a.status === 'present') hit(a.staff_id, 'hadir', a.date)
    else if (a.status === 'late') { hit(a.staff_id, 'hadir', a.date); hit(a.staff_id, 'terlambat', a.date) }
    else if (a.status === 'absent') hit(a.staff_id, 'alfa', a.date)
  }

  // Jumlah Kunjungan: same rule as the Target Progress "Kunjungan" row.
  for (const v of params.periodVisits) {
    if (!countsAsKunjungan(v, todayISO)) continue
    hit(v.attending_staff_id, 'kunjungan', v.visit_date, { patient_id: v.patient_id ?? null, ref_id: v.id, label: v.service_type }, true)
  }

  // Paket 1/2/3, TA/Sesi Visit, Paket Visit: from income transactions.
  for (const s of params.sales) {
    const key = s.category === 'PAKET KLINIK' ? packageTierKey(s.package)
      : s.category === 'PAKET VISIT' ? 'paket_visit'
      : s.category === 'TA VISIT' || s.category === 'SESI VISIT' ? 'ta_sesi_visit'
      : null
    if (key) hit(s.staff_id, key, s.transaction_date ?? start, { patient_id: s.patient_id ?? null, ref_id: s.id ?? null, label: s.category }, true)
  }

  for (const r of params.referrals) {
    if (r.first_date >= start && r.first_date <= end) hit(r.staff_id, 'rujukan_sm', r.first_date, { patient_id: r.patient_id ?? null })
  }
  return { hits, gap }
}

export function countHits(staffIds: string[], hits: PfotmHit[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {}
  for (const id of staffIds) out[id] = EMPTY_METRICS()
  for (const h of hits) out[h.staff_id][h.key] = (out[h.staff_id][h.key] ?? 0) + 1
  return out
}

export function computePfotmAutoMetrics(params: PfotmAutoInput): Record<string, Record<string, number>> {
  return countHits(params.staffIds, pfotmHits(params))
}
