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
  service_type: string | null
  kehadiran: 'HADIR' | 'TIDAK HADIR' | null
}

export interface PackageForProgress {
  id: string
  purchased_at: string
  category: 'PAKET KLINIK' | 'PAKET VISIT' | null
}

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
