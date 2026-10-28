// Payroll activity counted from income payments instead of Jadwal Harian visits,
// for branches whose Tarif Layanan rows carry `payroll_units` (migration 115).
// The fee is shared only once the patient has paid: a payment counts when it is
// LUNAS or PELUNASAN (a DP waits for its PELUNASAN), credited to the payment's
// Fisio (same attribution as the finance pages). Pure — the server action does
// the querying and hands rows in.

/** Payment statuses that release a therapist's fee. */
export const PAYROLL_PAYMENT_STATUSES = ['LUNAS', 'PELUNASAN'] as const

/**
 * Activity codes an employee can have counted over the whole branch
 * (`employee_payroll_profiles.branch_total_codes`), and the income categories
 * that make up that total — the Target Progress row of the same name, so the
 * number equals its Capaian for the payroll window.
 */
export const BRANCH_TOTAL_SALE_CATEGORIES: Record<string, string[]> = {
  TERAPI_AWAL_KLINIK: ['TERAPI AWAL KLINIK'],
}

export type PayrollUnits = Record<string, number>

export interface PaymentForPayroll {
  id: string
  staff_id: string | null
  patient_id: string | null
  transaction_date: string
  payment_status: string | null
  /** The payment's Layanan (lib/finance/priceList `pickLayanan`), null when unresolved. */
  layanan: { nama: string; payroll_units: PayrollUnits } | null
}

/** One counted payment: +units on `code` for `staff_id`. */
export interface PaymentActivityHit {
  staff_id: string
  code: string
  units: number
  payment: PaymentForPayroll
}

/** Codes a branch counts from payments: every code on any of its Layanan. */
export function paymentModeCodes(layanan: { payroll_units: PayrollUnits | null }[]): Set<string> {
  const codes = new Set<string>()
  for (const l of layanan) for (const [code, units] of Object.entries(l.payroll_units ?? {})) if (Number(units) > 0) codes.add(code)
  return codes
}

export function paymentActivityHits(params: {
  payments: PaymentForPayroll[]
  codes: Set<string>
  staffIds: string[]
}): PaymentActivityHit[] {
  const staff = new Set(params.staffIds)
  const hits: PaymentActivityHit[] = []
  for (const p of params.payments) {
    if (!p.staff_id || !staff.has(p.staff_id) || !p.layanan) continue
    if (!(PAYROLL_PAYMENT_STATUSES as readonly string[]).includes(p.payment_status ?? '')) continue
    for (const [code, raw] of Object.entries(p.layanan.payroll_units)) {
      const units = Number(raw)
      if (units > 0 && params.codes.has(code)) hits.push({ staff_id: p.staff_id, code, units, payment: p })
    }
  }
  return hits
}

export function sumPaymentHits(hits: PaymentActivityHit[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {}
  for (const h of hits) {
    out[h.staff_id] ??= {}
    out[h.staff_id][h.code] = (out[h.staff_id][h.code] ?? 0) + h.units
  }
  return out
}
