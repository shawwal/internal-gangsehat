export type CategoryKey = 'ta' | 'paket_klinik' | 'kunjungan' | 'paket_visit'

export interface CategoryDef {
  key: CategoryKey
  label: string
  color: string
}

// Fixed order — same 4 categories/colors already used in components/performance/KontrolTargetTab.tsx
export const CATEGORY_DEFS: CategoryDef[] = [
  { key: 'ta',           label: 'TA',           color: 'var(--primary)' },
  { key: 'paket_klinik', label: 'Paket Klinik', color: 'var(--chart-4)' },
  { key: 'kunjungan',    label: 'Kunjungan',    color: 'var(--secondary)' },
  { key: 'paket_visit',  label: 'Paket Visit',  color: 'var(--destructive)' },
]

export interface BranchOption {
  id: string
  name: string
}

export interface VisitForProgress {
  id: string
  visit_date: string
  service_type: string | null
}

export interface BranchTargetForProgress {
  target_ta: number
  target_paket_klinik: number
  target_kunjungan: number
  target_visit: number
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
