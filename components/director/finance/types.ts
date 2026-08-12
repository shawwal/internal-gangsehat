export interface BranchSummary {
  name: string
  income: number
  collected: number
  expense: number
  outstanding: number
  net: number
}

export interface TransactionRow {
  id: string
  branch_id: string
  patient_id: string | null
  type: string
  category: string
  harga: number | null
  discount: number | null
  amount: number | null
  outstanding: number | null
  payment_method: string | null
  payment_status: string | null
  status: string
  transaction_date: string
  description: string | null
  penjamin: string | null
  patient_name: string | null
  branch_name: string
}

export const PAGE_SIZE = 20

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']

export const TX_STATUS_VALUES = ['pending', 'confirmed', 'rejected'] as const
export const TX_STATUS_BADGE: Record<string, string> = {
  pending:   'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-green-500/15 text-green-400 border-green-500/30',
  rejected:  'bg-red-500/15 text-red-400 border-red-500/30',
}
export const TX_STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu', confirmed: 'Dikonfirmasi', rejected: 'Ditolak',
}

export const PAY_STATUS_VALUES = ['LUNAS', 'DP', 'PELUNASAN'] as const
export const PAY_STATUS_BADGE: Record<string, string> = {
  LUNAS:     'bg-green-500/15 text-green-400',
  DP:        'bg-yellow-500/15 text-yellow-400',
  PELUNASAN: 'bg-primary/15 text-primary',
}

export interface FinanceParams {
  branchId: string
  month: string
  year: string
  q: string
  noPatient: boolean
  txType: 'income' | 'expense' | ''
  status: typeof TX_STATUS_VALUES[number] | ''
  payStatus: typeof PAY_STATUS_VALUES[number] | ''
  page: number
}

// Build the /director/finance URL preserving existing params but changing one key
export function buildFinanceUrl(base: Record<string, string>, overrides: Record<string, string | undefined>) {
  const p = new URLSearchParams()
  const merged = { ...base, ...overrides }
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== '') p.set(k, v)
  }
  const qs = p.toString()
  return qs ? `/director/finance?${qs}` : '/director/finance'
}

export function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n)
}
