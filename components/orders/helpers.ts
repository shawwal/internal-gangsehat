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

// Returns the active package matching the order's service_type, or the first active one.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMatchingPackage(row: OrderRow): any | null {
  const packages: any[] = row.patients?.patient_packages
  if (!packages?.length) return null
  const serviceType = (row.service_type ?? '').trim()
  return (
    packages.find((p) => p.status === 'active' && p.package_name === serviceType) ??
    packages.find((p) => p.status === 'active') ??
    null
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calcRemainingSessions(pkg: any): number {
  if (!pkg) return 0
  const used = ['t1','t2','t3','t4','t5','t6','t7','t8','t9','t10']
    .filter((f) => pkg[f] != null).length
  return Math.max(0, (pkg.total_sessions ?? 0) - used)
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
