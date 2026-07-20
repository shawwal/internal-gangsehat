import type { RecordCompleteness, RecordPeriod, RecordSortOrder } from '@/app/actions/medicalRecords'

export type { MedicalRecordRow, RecordScope, BranchOption, StaffOption } from '@/app/actions/medicalRecords'

export interface RecordFiltersState {
  search: string
  completeness: RecordCompleteness
  period: RecordPeriod
  sortOrder: RecordSortOrder
  staffId: string   // 'all' or uuid — team scope only
  branchId: string  // 'all' or uuid — director only
}

export const DEFAULT_RECORD_FILTERS: RecordFiltersState = {
  search: '',
  completeness: 'incomplete',
  period: '30',
  sortOrder: 'desc',
  staffId: 'all',
  branchId: 'all',
}

export const PAGE_SIZE = 10

export const PERIOD_OPTIONS: { value: RecordPeriod; label: string }[] = [
  { value: '7',   label: '7 Hari Terakhir' },
  { value: '30',  label: '30 Hari Terakhir' },
  { value: '90',  label: '90 Hari Terakhir' },
  { value: 'all', label: 'Semua Waktu' },
]

export const COMPLETENESS_TABS: { value: RecordCompleteness; label: string }[] = [
  { value: 'incomplete', label: 'Belum Lengkap' },
  { value: 'complete',   label: 'Lengkap' },
  { value: 'all',        label: 'Semua' },
]

export function formatRecordDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
