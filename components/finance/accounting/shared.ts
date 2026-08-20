import type { PaymentDetailStatus, PaymentMethod } from '@/types'

export const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export const PAYMENT_METHODS: PaymentMethod[] = ['TUNAI', 'TRANSFER BCA', 'EDC BCA']
export const PAYMENT_STATUSES: PaymentDetailStatus[] = ['LUNAS', 'DP', 'PELUNASAN']

// The coarse income buckets `transactions.category` actually stores app-wide
// (see SERVICE_TO_CATEGORY in app/actions/transactions.ts and the INCOME_CATEGORIES
// list used by finance/transactions, director/finance, PaymentDialog, etc.) —
// also the same set `internal_layanan.kategori` is chosen from. Aggregations here
// (Laporan, Arus Kas) must key off this list, not the specific item name, or they
// won't match any transaction actually recorded anywhere else in the app.
export const INCOME_CATEGORIES = [
  'TA KLINIK', 'SESI KLINIK', 'PAKET KLINIK',
  'TA VISIT', 'SESI VISIT', 'PAKET VISIT', 'SPORT MASSAGE', 'LAINNYA',
]

export function formatRp(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export function formatNum(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n)
}

export function monthRange(year: number, month: number): { from: string; toExclusive: string } {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const toExclusive = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  return { from, toExclusive }
}

export function yearRange(year: number): { from: string; toExclusive: string } {
  return { from: `${year}-01-01`, toExclusive: `${year + 1}-01-01` }
}

export const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
