// One definition of "what counts" for every achievement number: Target Progress
// (branch-wide), PFOTM and Payroll (per therapist). Pure — callers query with
// the constants below and pass rows in, so the per-therapist columns add up to
// the Target Progress branch totals for the same date window.

/** Visit statuses that can count (a scheduled visit counts once attended). */
export const KUNJUNGAN_VISIT_STATUSES = ['scheduled', 'completed'] as const

/** PostgREST `.or()` filter: sport massage is tracked separately — not a kunjungan. */
export const KUNJUNGAN_SERVICE_FILTER = 'service_type.is.null,service_type.neq."SPORT MASSAGE"'

/**
 * Income transactions that count as one sale. PELUNASAN is left out on purpose:
 * a DP + PELUNASAN pair is one sale.
 */
export const SALE_PAYMENT_STATUSES = ['LUNAS', 'DP'] as const

/** Package purchases — the only sales that may be paid in instalments, so the only ones with extra validity checks. */
export const PACKAGE_SALE_CATEGORIES = ['PAKET KLINIK', 'PAKET VISIT'] as const

export interface VisitForAchievement {
  visit_date: string
  kehadiran: 'HADIR' | 'TIDAK HADIR' | null
  status?: string | null
  service_type?: string | null
  /** Record form completed ("Sudah Ditangani / Sudah Diperiksa") — see lib/metrics/recordStatus.ts. */
  record_complete: boolean
}

/**
 * Explicit HADIR counts; an unmarked visit counts only once its date has
 * passed (same convention as the performance dashboards).
 */
export function visitAttended(v: Pick<VisitForAchievement, 'kehadiran' | 'visit_date'>, todayISO: string): boolean {
  if (v.kehadiran === 'HADIR') return true
  return v.kehadiran == null && v.visit_date < todayISO
}

/**
 * Why a visit is not a Kunjungan (empty = it counts): an attended,
 * non-cancelled, non-sport-massage visit whose record form is completed — an
 * unfinished record is an unfinished treatment.
 */
export function kunjunganIssues(v: VisitForAchievement, todayISO: string): string[] {
  const issues: string[] = []
  if (v.status != null && !(KUNJUNGAN_VISIT_STATUSES as readonly string[]).includes(v.status)) issues.push(`Status ${v.status}`)
  if (v.service_type === 'SPORT MASSAGE') issues.push('Sport massage')
  if (!visitAttended(v, todayISO)) issues.push(v.kehadiran === 'TIDAK HADIR' ? 'Tidak hadir' : 'Belum ditandai hadir')
  if (!v.record_complete) issues.push(v.service_type === 'TERAPI AWAL' ? 'Belum Diperiksa' : 'Belum Ditangani')
  return issues
}

/** A "Kunjungan": an attended, non-cancelled, non-sport-massage visit with a completed record. */
export function countsAsKunjungan(v: VisitForAchievement, todayISO: string): boolean {
  return kunjunganIssues(v, todayISO).length === 0
}

// ── Sales ───────────────────────────────────────────────────────────────────

/** An income transaction, already attributed to a therapist (`staff_id`). */
export interface SaleTx {
  id: string
  order_id: string | null
  category: string
  payment_status: string | null
  patient_id: string | null
  staff_id: string | null
  receipt_url: string | null
  harga: number | null
  discount: number | null
  amount: number | null
  transaction_date: string
}

/** One purchase: every payment row sharing an order + category (or a lone row). */
export interface Purchase {
  rows: SaleTx[]
  /** The row that counts as the sale: the earliest LUNAS / DP payment. */
  first: SaleTx | null
  /** harga − discount of the purchase */
  tagihan: number
  paid: number
  /** Payment that brings the total to the price (null while still owed). */
  completing: SaleTx | null
}

const num = (n: number | null | undefined) => Number(n ?? 0)

const purchaseKey = (t: SaleTx) => (t.order_id ? `${t.order_id}|${t.category}` : `tx|${t.id}`)

/**
 * Groups payment rows into purchases. `rows` must include every non-rejected
 * row of each order involved (not only the ones in the date window), so DP /
 * PELUNASAN pairs straddling a period are judged as a whole.
 */
export function groupPurchases(rows: SaleTx[]): Map<string, Purchase> {
  const byKey = new Map<string, SaleTx[]>()
  for (const r of rows) {
    const k = purchaseKey(r)
    if (!byKey.get(k)?.some((x) => x.id === r.id)) byKey.set(k, [...(byKey.get(k) ?? []), r])
  }
  const byTx = new Map<string, Purchase>()
  for (const list of byKey.values()) {
    list.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.id.localeCompare(b.id))
    const first = list.find((r) => (SALE_PAYMENT_STATUSES as readonly string[]).includes(r.payment_status ?? '')) ?? null
    const base = first ?? list[0]
    const tagihan = Math.max(num(base.harga) - num(base.discount), 0)
    let running = 0
    let completing: SaleTx | null = null
    for (const r of list) {
      running += num(r.amount)
      if (!completing && tagihan > 0 && running >= tagihan) completing = r
    }
    const purchase: Purchase = { rows: list, first, tagihan, paid: running, completing }
    for (const r of list) byTx.set(r.id, purchase)
  }
  return byTx
}

/**
 * Why a transaction is not a valid sale (empty = it counts). Only the first
 * LUNAS / DP payment of a purchase is a sale. Packages — the only purchases
 * paid in instalments — must also have a patient, a Fisio, a proof of payment
 * (cash included) and amounts that match the price.
 */
export function saleIssues(t: SaleTx, purchase: Purchase | undefined): string[] {
  if (!(SALE_PAYMENT_STATUSES as readonly string[]).includes(t.payment_status ?? '')) {
    return [t.payment_status ? `Pembayaran ${t.payment_status} (cicilan)` : 'Tanpa status bayar']
  }
  if (purchase?.first && purchase.first.id !== t.id) return ['Pembayaran lanjutan — dihitung di pembayaran pertama']
  if (!(PACKAGE_SALE_CATEGORIES as readonly string[]).includes(t.category)) return []

  const issues: string[] = []
  if (!t.patient_id) issues.push('Tanpa pasien')
  if (!t.staff_id) issues.push('Tanpa Fisio')
  if (!t.receipt_url) issues.push('Tanpa bukti bayar')
  const tagihan = Math.max(num(t.harga) - num(t.discount), 0)
  const amount = num(t.amount)
  if (tagihan <= 0) issues.push('Harga kosong')
  else if (amount > tagihan) issues.push('Dibayar melebihi harga')
  else if (t.payment_status === 'LUNAS' && amount < tagihan) issues.push('LUNAS tapi dibayar kurang dari harga')
  else if (t.payment_status === 'DP' && amount >= tagihan) issues.push('DP sebesar harga penuh')
  if (purchase && tagihan > 0 && purchase.paid > tagihan && amount <= tagihan) issues.push('Total pembayaran melebihi harga')
  return issues
}

// ── Shared helpers ──────────────────────────────────────────────────────────

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
