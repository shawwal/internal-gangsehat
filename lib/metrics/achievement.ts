// One definition of "what counts" for every achievement number: Target Progress
// (branch-wide), PFOTM and Payroll (per therapist). Pure — callers query with
// the constants below and pass rows in, so the per-therapist columns add up to
// the Target Progress branch totals for the same date window.

/** Visit statuses that can count (a scheduled visit counts once attended). */
export const KUNJUNGAN_VISIT_STATUSES = ['scheduled', 'completed'] as const

/** PostgREST `.or()` filter: sport massage is tracked separately — not a kunjungan. */
export const KUNJUNGAN_SERVICE_FILTER = 'service_type.is.null,service_type.neq."SPORT MASSAGE"'

/**
 * Payment statuses that can open a sale. PELUNASAN never does, and installments
 * after the first payment of a purchase don't either — see `countedSaleIds`.
 */
export const SALE_PAYMENT_STATUSES = ['LUNAS', 'DP'] as const

/** An income payment, for telling apart the payments of one purchase. */
export interface SalePayment {
  id: string
  patient_id: string | null
  category: string
  payment_status: string | null
  transaction_date: string
  created_at?: string | null
  harga: number | null
  discount: number | null
  amount: number | null
}

/**
 * Ids of the payments that each start a purchase — one sale per purchase, no
 * matter how many installments (DP, DP, … then LUNAS/PELUNASAN) follow.
 *
 * Per patient + category, in date order: with no purchase open, a LUNAS/DP row
 * starts one (and counts); while a DP purchase is open, rows with the same
 * harga are its installments (not counted) until a LUNAS/PELUNASAN row or the
 * summed amount reaching harga − discount closes it. A different harga starts
 * a new purchase. Rows without a patient always count on their own.
 *
 * Pass every payment status (PELUNASAN included) and enough history before the
 * window that a purchase opened earlier is seen as open.
 */
export function countedSaleIds(rows: SalePayment[]): Set<string> {
  const counted = new Set<string>()
  const groups = new Map<string, SalePayment[]>()
  for (const r of rows) {
    if (!r.patient_id) {
      if ((SALE_PAYMENT_STATUSES as readonly string[]).includes(r.payment_status ?? '')) counted.add(r.id)
      continue
    }
    const key = `${r.patient_id}|${r.category}`
    const list = groups.get(key)
    if (list) list.push(r)
    else groups.set(key, [r])
  }

  for (const list of groups.values()) {
    list.sort((a, b) =>
      a.transaction_date.localeCompare(b.transaction_date) || (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    let open: { harga: number; due: number; paid: number } | null = null
    for (const r of list) {
      const harga = Number(r.harga ?? 0)
      if (open && harga !== open.harga) open = null
      if (!open) {
        if (!(SALE_PAYMENT_STATUSES as readonly string[]).includes(r.payment_status ?? '')) continue
        counted.add(r.id)
        if (r.payment_status !== 'DP') continue
        open = { harga, due: harga - Number(r.discount ?? 0), paid: 0 }
      }
      open.paid += Number(r.amount ?? 0)
      if (r.payment_status === 'LUNAS' || r.payment_status === 'PELUNASAN' || open.paid >= open.due) open = null
    }
  }
  return counted
}

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
  /** sales rows only: LUNAS / DP / PELUNASAN */
  paymentStatus?: string | null
  /** sales rows only: TUNAI / TRANSFER BCA / DOKU QRIS … */
  paymentMethod?: string | null
}

export interface MetricDetail {
  rows: MetricDetailRow[]
  /** auto-counted value (= rows.length) */
  auto: number
  /** manual correction, when one is set */
  override: number | null
}
