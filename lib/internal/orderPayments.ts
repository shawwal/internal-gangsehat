// SALDO model: an order's balance is total tagihan (harga - discount) minus the
// sum of all its payment rows. Each payment is its own history row — admins
// never edit a past payment, they add a new one (DP -> Cicilan -> Pelunasan).

export interface OrderPaymentRow {
  id: string
  transaction_date: string
  amount: number
  harga: number
  discount: number
  payment_method: string | null
  description: string | null
}

export interface OrderPaymentHistoryEntry {
  id: string
  date: string
  nominal: number
  method: string | null
  keterangan: string | null
  sisaAfter: number
}

export type OrderPaymentStatusLabel = 'Belum Bayar' | 'DP' | 'Cicilan' | 'Lunas'

export interface OrderPaymentSummary {
  harga: number
  discount: number
  tagihan: number
  totalPaid: number
  sisa: number
  statusLabel: OrderPaymentStatusLabel
  history: OrderPaymentHistoryEntry[]
}

export function computeOrderPaymentSummary(rows: OrderPaymentRow[]): OrderPaymentSummary {
  if (rows.length === 0) {
    return { harga: 0, discount: 0, tagihan: 0, totalPaid: 0, sisa: 0, statusLabel: 'Belum Bayar', history: [] }
  }

  const sorted = [...rows].sort(
    (a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.id.localeCompare(b.id),
  )
  const harga = sorted[0].harga
  const discount = sorted[0].discount
  const tagihan = Math.max(harga - discount, 0)

  let running = 0
  const history: OrderPaymentHistoryEntry[] = sorted.map((r, i) => {
    running += r.amount
    const sisaAfter = Math.max(tagihan - running, 0)
    return {
      id: r.id,
      date: r.transaction_date,
      nominal: r.amount,
      method: r.payment_method,
      keterangan: r.description || (i === 0 ? 'DP' : sisaAfter === 0 ? 'Pelunasan' : 'Cicilan'),
      sisaAfter,
    }
  })

  const totalPaid = running
  const sisa = Math.max(tagihan - totalPaid, 0)
  const statusLabel: OrderPaymentStatusLabel =
    totalPaid === 0 ? 'Belum Bayar' : sisa === 0 ? 'Lunas' : sorted.length === 1 ? 'DP' : 'Cicilan'

  return { harga, discount, tagihan, totalPaid, sisa, statusLabel, history }
}
