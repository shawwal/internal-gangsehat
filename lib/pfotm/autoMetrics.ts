// Auto metrics for PFOTM (replaces the Kunjungan / Keuangan / Rujukan SM imports
// and the Hadir/Terlambat/Alfa columns typed from the ABS sheet). Pure module.

import { isRecordComplete, visitAttended, type VisitForPayroll } from '@/lib/payroll/autoActivity'

export const CLINIC_VISIT_TYPES = ['TERAPI AWAL', 'SESI TERAPI', 'PAKET TERAPI']

// Income categories that feed the sales columns, and the payment statuses that
// count. PELUNASAN is left out on purpose: a DP + PELUNASAN pair is one sale.
export const SALES_CATEGORIES = ['PAKET KLINIK', 'TA VISIT', 'SESI VISIT', 'PAKET VISIT']
export const SALES_PAYMENT_STATUSES = ['LUNAS', 'DP']

export interface AttendanceForPfotm {
  staff_id: string
  status: 'present' | 'absent' | 'late' | 'leave' | 'sick' | 'izin'
}

export interface PackageInfo {
  id: string
  jenis_paket: string | null    // P1 | P2 | (future P3)
  total_sessions: number
}

/** An income transaction (LUNAS/DP) already attributed to a therapist. */
export interface SaleForPfotm {
  staff_id: string | null
  category: string
  /** The package bought, when the transaction links to one (PAKET KLINIK tiering). */
  package: PackageInfo | null
}

function packageTierKey(pkg: PackageInfo | null): 'paket_1' | 'paket_2' | 'paket_3' {
  const tier = pkg?.jenis_paket ?? (pkg && pkg.total_sessions >= 10 ? 'P2' : 'P1')
  return tier === 'P3' ? 'paket_3' : tier === 'P2' ? 'paket_2' : 'paket_1'
}

export function computePfotmAutoMetrics(params: {
  staffIds: string[]
  start: string
  end: string
  todayISO: string
  attendance: AttendanceForPfotm[]
  /** clinic visits dated inside the period */
  periodVisits: VisitForPayroll[]
  /** LUNAS/DP income transactions dated inside the period */
  sales: SaleForPfotm[]
  /** referred patients: referring staff + date of the patient's first visit (or registration) */
  referrals: { staff_id: string; first_date: string }[]
}): Record<string, Record<string, number>> {
  const { staffIds, start, end, todayISO } = params
  const out: Record<string, Record<string, number>> = {}
  for (const id of staffIds) {
    out[id] = { hadir: 0, terlambat: 0, alfa: 0, kunjungan: 0, paket_1: 0, paket_2: 0, paket_3: 0, ta_sesi_visit: 0, paket_visit: 0, rujukan_sm: 0 }
  }
  const bump = (id: string | null, key: string) => { if (id && out[id]) out[id][key]++ }

  for (const a of params.attendance) {
    if (a.status === 'present') bump(a.staff_id, 'hadir')
    else if (a.status === 'late') { bump(a.staff_id, 'hadir'); bump(a.staff_id, 'terlambat') }
    else if (a.status === 'absent') bump(a.staff_id, 'alfa')
  }

  // Jumlah Kunjungan: only visits whose medical record is "Lengkap".
  for (const v of params.periodVisits) {
    if (!v.service_type || !CLINIC_VISIT_TYPES.includes(v.service_type)) continue
    if (!visitAttended(v, todayISO) || !isRecordComplete(v)) continue
    bump(v.attending_staff_id, 'kunjungan')
  }

  // Paket 1/2/3, TA/Sesi Visit, Paket Visit: from income transactions.
  for (const s of params.sales) {
    if (s.category === 'PAKET KLINIK') bump(s.staff_id, packageTierKey(s.package))
    else if (s.category === 'PAKET VISIT') bump(s.staff_id, 'paket_visit')
    else if (s.category === 'TA VISIT' || s.category === 'SESI VISIT') bump(s.staff_id, 'ta_sesi_visit')
  }

  for (const r of params.referrals) {
    if (r.first_date >= start && r.first_date <= end) bump(r.staff_id, 'rujukan_sm')
  }
  return out
}
