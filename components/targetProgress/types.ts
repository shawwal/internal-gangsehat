export type CategoryKey = 'ta' | 'paket_klinik' | 'kunjungan' | 'paket_visit' | 'sesi'

export interface CategoryDef {
  key: CategoryKey
  label: string
  color: string
}

// Fixed order — same categories/colors already used in components/performance/KontrolTargetTab.tsx
export const CATEGORY_DEFS: CategoryDef[] = [
  { key: 'ta',           label: 'TA',           color: 'var(--primary)' },
  { key: 'paket_klinik', label: 'Paket Klinik', color: 'var(--chart-4)' },
  { key: 'kunjungan',    label: 'Kunjungan',    color: 'var(--secondary)' },
  { key: 'paket_visit',  label: 'Paket Visit',  color: 'var(--destructive)' },
  { key: 'sesi',         label: 'Sesi',         color: 'var(--chart-5)' },
]

export interface BranchOption {
  id: string
  name: string
}

export interface VisitForProgress {
  id: string
  visit_date: string
  kehadiran: 'HADIR' | 'TIDAK HADIR' | null
}

export interface TransactionForProgress {
  category: string
  transaction_date: string
}

// TA/Sesi stay merged Klinik+Visit (matches current product behavior — only the
// payment-status gate was wrong, not the Klinik/Visit grouping). Paket already
// splits Klinik vs Visit into separate rows/categories.
export const TRANSACTION_CATEGORY_MAP: Record<string, CategoryKey> = {
  'TA KLINIK': 'ta',
  'TA VISIT': 'ta',
  'SESI KLINIK': 'sesi',
  'SESI VISIT': 'sesi',
  'PAKET KLINIK': 'paket_klinik',
  'PAKET VISIT': 'paket_visit',
}

// Reverse of TRANSACTION_CATEGORY_MAP — which transactions.category strings
// count toward a given CategoryKey, for the detail popup's per-day query.
export const CATEGORY_TO_TRANSACTION_TYPES: Partial<Record<CategoryKey, string[]>> = Object.entries(
  TRANSACTION_CATEGORY_MAP,
).reduce((acc, [txCategory, key]) => {
  (acc[key] ??= []).push(txCategory)
  return acc
}, {} as Partial<Record<CategoryKey, string[]>>)

// Roles allowed to edit/delete a transaction from the target-progress detail
// popup — mirrors PAYMENT_ROLES in app/actions/transactions.ts (not exported
// since that file is 'use server' and can only export async functions).
export const EDITABLE_ROLES = ['finance', 'manager', 'director', 'admin'] as const

export interface BranchTargetForProgress {
  target_ta: number
  target_paket_klinik: number
  target_kunjungan: number
  target_visit: number
  target_sesi: number
}

// index 0 = day 1
export type DailyCounts = Record<CategoryKey, number[]>

export interface CategorySummary {
  key: CategoryKey
  label: string
  color: string
  target: number
  actual: number
  selisih: number
  daily: number[]
}
