import type { OrderRow } from './types'

export function getPatientName(row: OrderRow): string {
  return row.guest_name ?? row.patients?.encrypted_name ?? '—'
}

export function getTrxCode(row: OrderRow): string {
  return row.internal_order_meta?.[0]?.kode_transaksi ?? '—'
}

export function getPaymentStatus(row: OrderRow): string {
  return row.internal_order_meta?.[0]?.status_bayar ?? 'Belum Lunas'
}

export function getTherapistName(row: OrderRow): string {
  return row.therapists?.profiles?.full_name ?? '—'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyDateFilter(q: any, m: string, y: string, col = 'scheduled_date') {
  if (m && y) {
    const mm = m.padStart(2, '0')
    const nm = String(Number(m) % 12 + 1).padStart(2, '0')
    const ny = Number(m) === 12 ? Number(y) + 1 : y
    q = q.gte(col, `${y}-${mm}-01`).lt(col, `${ny}-${nm}-01`)
  } else if (y) {
    q = q.gte(col, `${y}-01-01`).lt(col, `${Number(y) + 1}-01-01`)
  }
  return q
}
