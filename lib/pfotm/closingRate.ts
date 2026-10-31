// Closing rate (PFOTM stats only, never points): of a therapist's TERAPI AWAL
// KLINIK patients in the PFOTM period, how many bought SESI KLINIK or PAKET
// KLINIK within CLOSING_WINDOW_DAYS calendar days of the TA — from any seller,
// even when the purchase falls after the period ends. Pure — the server action
// queries and hands rows in.

import { addDays } from '@/lib/payroll/period'

export const CLOSING_WINDOW_DAYS = 4
export const CLOSING_CATEGORIES = ['SESI KLINIK', 'PAKET KLINIK'] as const

export interface ClosingSale {
  id: string
  patient_id: string | null
  category: string
  transaction_date: string
}

export interface ClosingHit {
  ta: ClosingSale
  /** The first qualifying follow-up purchase, or null = not closed */
  closedBy: ClosingSale | null
}

/** One row per TA sale; a patient's follow-up counts from the TA date to TA + window days. */
export function closingHits(taSales: ClosingSale[], followUps: ClosingSale[], windowDays = CLOSING_WINDOW_DAYS): ClosingHit[] {
  const byPatient = new Map<string, ClosingSale[]>()
  for (const f of followUps) {
    if (!f.patient_id || !(CLOSING_CATEGORIES as readonly string[]).includes(f.category)) continue
    byPatient.set(f.patient_id, [...(byPatient.get(f.patient_id) ?? []), f])
  }
  for (const list of byPatient.values()) list.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
  return taSales.map((ta) => {
    const last = addDays(ta.transaction_date, windowDays)
    const closedBy = (ta.patient_id ? byPatient.get(ta.patient_id) : undefined)
      ?.find((f) => f.transaction_date >= ta.transaction_date && f.transaction_date <= last) ?? null
    return { ta, closedBy }
  })
}

/** closed ÷ TA, 0 when there were no TA. */
export function closingRate(hits: ClosingHit[]): number {
  return hits.length ? hits.filter((h) => h.closedBy).length / hits.length : 0
}
