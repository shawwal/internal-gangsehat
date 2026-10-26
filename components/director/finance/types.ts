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
  receipt_url: string | null
  patient_name: string | null
  branch_name: string
  therapist: { id: string; name: string } | null
  service_name: string | null
}

export const PAGE_SIZE = 20

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']

// Period picked in the month select: a month '1'..'12', a semester, or the
// whole year. Remembered per browser in a cookie (read server-side so the first
// render already loads the narrower period — no full-year fetch then redirect).
export const FINANCE_PERIOD_COOKIE = 'finance_period'
export const PERIOD_ALL_YEAR = 'all'
export const PERIOD_SEMESTERS = { s1: 'Semester 1 (Jan–Jun)', s2: 'Semester 2 (Jul–Des)' } as const

export function isFinancePeriod(v: string | undefined): v is string {
  if (!v) return false
  if (v === PERIOD_ALL_YEAR || v in PERIOD_SEMESTERS) return true
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 12
}

/** Semester containing today — the default when nothing is remembered. */
export function currentSemester(): keyof typeof PERIOD_SEMESTERS {
  return new Date().getMonth() < 6 ? 's1' : 's2'
}

export const TX_STATUS_VALUES = ['pending', 'confirmed', 'rejected'] as const
export const TX_STATUS_BADGE: Record<string, string> = {
  pending:   'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-green-500/15 text-green-400 border-green-500/30',
  rejected:  'bg-red-500/15 text-red-400 border-red-500/30',
}
export const TX_STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu', confirmed: 'Dikonfirmasi', rejected: 'Ditolak',
}

export const PAY_STATUS_VALUES = ['LUNAS', 'DP', 'CICILAN', 'PELUNASAN'] as const
export const PAY_STATUS_BADGE: Record<string, string> = {
  LUNAS:     'bg-green-500/15 text-green-400',
  DP:        'bg-yellow-500/15 text-yellow-400',
  CICILAN:   'bg-orange-500/15 text-orange-400',
  PELUNASAN: 'bg-primary/15 text-primary',
}

export interface FinanceParams {
  branchId: string
  /** '1'..'12', 's1' / 's2' (semester) or 'all' (whole year) — see isFinancePeriod */
  month: string
  year: string
  /** YYYY-MM-DD, inclusive. Either set → overrides month/year as the period. */
  from: string
  to: string
  /** internal_profiles.id — attribution rule in lib/finance/attribution.ts */
  therapist: string
  /** transactions.category (the "layanan" filter) */
  category: string
  q: string
  noPatient: boolean
  txType: 'income' | 'expense' | ''
  status: typeof TX_STATUS_VALUES[number] | ''
  payStatus: typeof PAY_STATUS_VALUES[number] | ''
  /** List order: '' = newest first; patient_asc/desc = by patient name (A–Z / Z–A) */
  sort: 'patient_asc' | 'patient_desc' | ''
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
