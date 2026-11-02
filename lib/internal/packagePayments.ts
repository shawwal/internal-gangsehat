import type { createClient } from '@/lib/supabase/server'
import { fetchInChunks } from '@/lib/supabase/fetchAll'
import { PACKAGE_CATEGORIES } from '@/lib/serviceType'

type Supabase = Awaited<ReturnType<typeof createClient>>

// ── Package payment summary — the one rule for "is this package paid off" ──────
// Packages have no FK to transactions. Payment can be linked two ways:
//  1. order_id — the newer path (createTransactionManual with package_id), where
//     the transaction shares the package's own order_id.
//  2. visit_id → patient_visits.package_id — how the vast majority of existing
//     packages are actually linked: the transaction is tied to the visit that
//     prompted the sale, and that visit's package_id points back at the package.
// Both paths are checked and merged — relying on order_id alone misses nearly
// every historical package sale and would wrongly show them as unpaid.
//
// Not to be confused with patient_packages_with_stats.payment_ok, which is only
// the booking gate (any payment at all, e.g. a DP) — never show it as "Lunas".
//
// "Lunas" counts confirmed money only. Installments (Bayar Sisa → PELUNASAN /
// CICILAN) are recorded as `pending` until finance confirms them, and a pending
// row may still be rejected — until then the package is "menunggu konfirmasi".
export interface PackagePayment {
  harga: number | null
  amountPaid: number
  discount: number
  /** left to pay after every recorded (pending + confirmed) payment — drives "Bayar Sisa" */
  outstanding: number
  /** left to pay after confirmed payments only — drives "Lunas" */
  confirmedOutstanding: number
  /** order the installments are added to (addPaymentToOrder) — null on legacy rows */
  orderId: string | null
  category: string
  paymentMethod: string | null
  paymentStatus: 'LUNAS' | 'DP'
  transactionStatus: 'pending' | 'confirmed'
  /** payments still awaiting finance confirmation, oldest first */
  pending: PendingPaymentTx[]
}

// A recorded payment not yet confirmed — listed behind "Menunggu Konfirmasi".
export interface PendingPaymentRow {
  id: string
  transaction_date: string
  category: string
  harga: number | null
  amount: number
  payment_status: string | null
  payment_method: string | null
  receipt_url: string | null
  recorded_by_name: string | null
}
export type PendingPaymentTx = Omit<PendingPaymentRow, 'recorded_by_name'> & { recorded_by: string | null }

export function toPendingTx(r: PendingPaymentTx): PendingPaymentTx {
  return {
    id: r.id, transaction_date: r.transaction_date, category: r.category, harga: r.harga,
    amount: r.amount, payment_status: r.payment_status, payment_method: r.payment_method,
    receipt_url: r.receipt_url, recorded_by: r.recorded_by,
  }
}

interface PkgTxRow { id: string; order_id: string | null; category: string; payment_method: string | null; payment_status: string | null; transaction_date: string; harga: number; amount: number; discount: number; status: string; receipt_url: string | null; recorded_by: string | null }

const TX_COLUMNS = 'id, order_id, category, payment_method, payment_status, transaction_date, harga, amount, discount, status, receipt_url, recorded_by'

export async function fetchPackagePayments(
  supabase: Supabase,
  packages: { id: string; order_id: string | null }[],
): Promise<Map<string, PackagePayment>> {
  const result = new Map<string, PackagePayment>()
  if (packages.length === 0) return result

  const packageIds = packages.map((p) => p.id)
  const orderIds   = packages.map((p) => p.order_id).filter((v): v is string => !!v)

  const [orderTx, linkedVisits] = await Promise.all([
    fetchInChunks<PkgTxRow>(orderIds, (chunk) =>
      supabase.from('transactions')
        .select(TX_COLUMNS)
        .in('order_id', chunk)
        .in('category', [...PACKAGE_CATEGORIES])
        .neq('status', 'rejected')),
    fetchInChunks<{ id: string; package_id: string | null }>(packageIds, (chunk) =>
      supabase.from('patient_visits').select('id, package_id').in('package_id', chunk)),
  ])

  const orderToPackage = new Map(packages.filter((p) => p.order_id).map((p) => [p.order_id as string, p.id]))
  const visitToPackage = new Map(
    linkedVisits.filter((v) => v.package_id).map((v) => [v.id, v.package_id as string]),
  )

  const visitTx = await fetchInChunks<PkgTxRow & { visit_id: string }>([...visitToPackage.keys()], (chunk) =>
    supabase.from('transactions')
      .select(`visit_id, ${TX_COLUMNS}`)
      .in('visit_id', chunk)
      .in('category', [...PACKAGE_CATEGORIES])
      .neq('status', 'rejected'))

  const byPackage = new Map<string, PkgTxRow[]>()
  function addRow(pkgId: string | undefined, row: PkgTxRow) {
    if (!pkgId) return
    const list = byPackage.get(pkgId) ?? []
    // A payment linked by both its order and its visit counts once.
    if (list.some((r) => r.id === row.id)) return
    list.push(row)
    byPackage.set(pkgId, list)
  }
  for (const t of orderTx) addRow(orderToPackage.get(t.order_id as string), t)
  for (const t of visitTx) addRow(visitToPackage.get(t.visit_id), t)

  for (const p of packages) {
    const rows = byPackage.get(p.id)
    if (!rows || rows.length === 0) continue

    rows.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
    // The package's own order first; else the order of its first payment.
    const orderId = rows.find((r) => p.order_id && r.order_id === p.order_id)?.order_id
      ?? rows.find((r) => r.order_id)?.order_id
      ?? null
    const latest  = rows[rows.length - 1]

    const harga         = rows[0].harga
    const amountPaid     = rows.reduce((s, r) => s + (r.amount ?? 0), 0)
    // Installments copy the first payment's discount — count it once (SALDO model).
    const discountTotal  = rows[0].discount ?? 0
    const outstanding    = Math.max(harga - amountPaid - discountTotal, 0)
    const confirmedPaid  = rows.filter((r) => r.status === 'confirmed').reduce((s, r) => s + (r.amount ?? 0), 0)
    const confirmedOutstanding = Math.max(harga - confirmedPaid - discountTotal, 0)

    result.set(p.id, {
      harga,
      amountPaid,
      discount:          discountTotal,
      outstanding,
      confirmedOutstanding,
      orderId,
      category:          rows[0].category,
      paymentMethod:     latest.payment_method,
      paymentStatus:     outstanding === 0 ? 'LUNAS' : 'DP',
      transactionStatus: rows.some((r) => r.status === 'pending') ? 'pending' : 'confirmed',
      pending:           rows.filter((r) => r.status === 'pending').map(toPendingTx),
    })
  }
  return result
}

// Fully paid = confirmed package payments leave nothing outstanding. With no
// package payment rows, fall back to the view's payment_ok (legacy packages
// without an order are exempt; a payment on a linked visit under another
// category counts).
export function isPackagePaidOff(payment: PackagePayment | null | undefined, paymentOk: boolean | null | undefined): boolean {
  if (payment) return payment.confirmedOutstanding === 0
  return !!paymentOk
}

// Recorded payments cover the price, but part of it is still pending — show
// "Menunggu Konfirmasi", not "Lunas" (nor "Belum Lunas", which invites paying twice).
export function isPackageAwaitingConfirmation(payment: PackagePayment | null | undefined): boolean {
  return !!payment && payment.outstanding === 0 && payment.confirmedOutstanding > 0
}
