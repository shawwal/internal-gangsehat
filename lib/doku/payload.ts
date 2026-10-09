// Pure mapping from a paid payment link to its `transactions` income row, so the
// SALDO rules (DP / PELUNASAN / LUNAS) are unit-testable. Mirrors the columns
// createTransactionForVisit / addPaymentToOrder write (app/actions/transactions.ts).

import { TRANSACTION_METHOD, type PaymentLinkMethod } from './channels'

export interface PaidLink {
  id: string
  branch_id: string
  patient_id: string | null
  visit_id: string | null
  order_id: string | null
  method: PaymentLinkMethod
  amount: number
  harga: number
  discount: number
  category: string
  description: string | null
  invoice_number: string
  created_by: string | null
}

/** First (template) payment row of an existing order plus what's been paid so far. */
export interface OrderContext {
  template: {
    patient_id: string | null
    branch_id: string
    visit_id: string | null
    fisio_id: string | null
    category: string
    harga: number
    discount: number
  }
  totalPaid: number
}

export interface VisitContext {
  patient_id: string
  branch_id: string
  attending_staff_id: string | null
  order_id: string | null
}

/** First payment against a bill: covers it → LUNAS, otherwise DP. */
export function paymentStatusFor(harga: number, discount: number, amount: number) {
  return amount >= Math.max(harga - discount, 0) ? 'LUNAS' : 'DP'
}

export function buildIncomePayload(
  link: PaidLink,
  ctx: { order?: OrderContext | null; visit?: VisitContext | null },
  paid: { paidAt: string; reference: string | null; channelLabel: string },
) {
  const txDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(paid.paidAt))
  const note = [
    link.description,
    `DOKU ${link.invoice_number}`,
    paid.channelLabel,
    paid.reference ? `ref ${paid.reference}` : null,
  ].filter(Boolean).join(' · ')

  const base = {
    type: 'income' as const,
    amount: link.amount,
    payment_method: TRANSACTION_METHOD[link.method],
    description: note,
    transaction_date: txDate,
    status: 'confirmed' as const,
    recorded_by: link.created_by,
    confirmed_by: link.created_by,
    updated_at: new Date().toISOString(),
  }

  // Installment on an order that already has payment rows (SALDO model).
  if (link.order_id && ctx.order) {
    const t = ctx.order.template
    const fullyPaid = ctx.order.totalPaid + link.amount >= Math.max(t.harga - t.discount, 0)
    return {
      ...base,
      order_id: link.order_id,
      visit_id: t.visit_id,
      patient_id: t.patient_id,
      branch_id: t.branch_id,
      fisio_id: t.fisio_id,
      category: t.category,
      harga: t.harga,
      discount: t.discount,
      payment_status: fullyPaid ? 'LUNAS' : 'PELUNASAN',
    }
  }

  const harga = link.harga > 0 ? link.harga : link.amount
  return {
    ...base,
    order_id: link.order_id ?? ctx.visit?.order_id ?? null,
    visit_id: link.visit_id,
    patient_id: ctx.visit?.patient_id ?? link.patient_id,
    branch_id: ctx.visit?.branch_id ?? link.branch_id,
    fisio_id: ctx.visit?.attending_staff_id ?? null,
    category: link.category,
    harga,
    discount: link.discount,
    payment_status: paymentStatusFor(harga, link.discount, link.amount),
  }
}

export interface TokoSaleContext {
  branch_id: string
  patient_id: string | null
  total: number
  items: { product_name: string; qty: number }[]
}

/** "Buku A ×2" / "3 item · Buku A dll." — same wording as cash toko sales. */
export function tokoSaleDescription(items: TokoSaleContext['items']): string {
  if (items.length === 0) return 'Penjualan toko'
  const first = items[0]
  return items.length > 1 ? `${items.length} item · ${first.product_name} dll.` : `${first.product_name} ×${first.qty}`
}

/** Income row for a paid toko sale link: category TOKO, never tied to a visit/order. */
export function buildTokoIncomePayload(
  link: PaidLink,
  sale: TokoSaleContext,
  paid: { paidAt: string; reference: string | null; channelLabel: string },
) {
  const txDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(paid.paidAt))
  return {
    type: 'income' as const,
    category: 'TOKO',
    harga: sale.total,
    discount: 0,
    amount: link.amount,
    payment_method: TRANSACTION_METHOD[link.method],
    payment_status: link.amount >= sale.total ? 'LUNAS' : 'DP',
    description: [
      tokoSaleDescription(sale.items),
      `DOKU ${link.invoice_number}`,
      paid.channelLabel,
      paid.reference ? `ref ${paid.reference}` : null,
    ].filter(Boolean).join(' · '),
    transaction_date: txDate,
    status: 'confirmed' as const,
    branch_id: sale.branch_id,
    patient_id: sale.patient_id,
    visit_id: null,
    order_id: null,
    fisio_id: null,
    recorded_by: link.created_by,
    confirmed_by: link.created_by,
    updated_at: new Date().toISOString(),
  }
}
