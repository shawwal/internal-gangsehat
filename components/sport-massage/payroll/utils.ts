import type { SportMassageExportRow } from '@/app/actions/sportMassageExport'
import type { SportMassageFeeRate } from '@/app/actions/sportMassagePayroll'

export const rateKey = (staffId: string | null, layananId: string) => `${staffId ?? ''}:${layananId}`

/** A session is paid when the patient attended and the visit wasn't cancelled. */
export const isPaidSession = (v: Pick<SportMassageExportRow, 'kehadiran' | 'status'>) =>
  v.kehadiran === 'HADIR' && v.status !== 'cancelled'

export type FeeLookup = (staffId: string | null, layananId: string | null) => number | null

/** Therapist's own rate, else the branch default for the Layanan; null = no rate set. */
export function buildFeeLookup(rates: SportMassageFeeRate[]): FeeLookup {
  const map = new Map(rates.map((r) => [rateKey(r.staff_id, r.layanan_id), r.fee]))
  return (staffId, layananId) => {
    if (!layananId) return null
    return (staffId ? map.get(rateKey(staffId, layananId)) : undefined) ?? map.get(rateKey(null, layananId)) ?? null
  }
}

/** Payroll window month containing `d` (period ends on the 26th by default). */
export function currentPeriod(d = new Date(), startDay = 27): { month: number; year: number } {
  let month = d.getMonth() + 1
  let year = d.getFullYear()
  if (d.getDate() >= startDay) {
    month += 1
    if (month === 13) { month = 1; year += 1 }
  }
  return { month, year }
}
