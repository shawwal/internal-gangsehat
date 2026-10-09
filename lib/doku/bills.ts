// "What is this patient paying for?" — the bill options the payment-link dialog
// offers as one-tap chips. Pure (unit-tested); the data comes from
// getPaymentLinkDefaults in app/actions/paymentLinks.ts.

export interface BillOption {
  key: string
  label: string
  amount: number
  harga: number
  discount: number
  category: string
  orderId?: string | null
  visitId?: string | null
  description?: string | null
}

export interface OutstandingEntry {
  order_id: string | null
  category: string
  harga: number
  discount: number
  outstanding: number
}

// The price list can't tell package tiers apart (PaymentDialog has the same rule).
const PACKAGE_CATEGORIES = new Set(['PAKET KLINIK', 'PAKET VISIT'])

export function visitBill(input: {
  visitId: string
  category: string
  price: number | null
  description?: string | null
}): BillOption | null {
  if (input.price == null || input.price <= 0 || PACKAGE_CATEGORIES.has(input.category)) return null
  return {
    key: `visit:${input.visitId}`,
    label: `Kunjungan ini · ${input.category}`,
    amount: input.price,
    harga: input.price,
    discount: 0,
    category: input.category,
    visitId: input.visitId,
    description: input.description ?? null,
  }
}

/** This visit first, then every outstanding order balance (orders only — a
 *  payment can only be attached as an installment through order_id). The
 *  host's preferred order, when given, jumps to the front. */
export function orderBills(
  visit: BillOption | null,
  outstanding: OutstandingEntry[],
  preferOrderId?: string | null,
): BillOption[] {
  const orders: BillOption[] = outstanding
    .filter((o) => o.order_id && o.outstanding > 0)
    .map((o) => ({
      key: `order:${o.order_id}`,
      label: `Sisa ${o.category}`,
      amount: o.outstanding,
      harga: o.harga,
      discount: o.discount,
      category: o.category,
      orderId: o.order_id,
      description: 'Pelunasan',
    }))

  const bills = visit ? [visit, ...orders] : orders
  if (preferOrderId) {
    const i = bills.findIndex((b) => b.orderId === preferOrderId)
    if (i > 0) bills.unshift(...bills.splice(i, 1))
  }
  return bills
}
