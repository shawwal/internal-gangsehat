import { SERVICE_TYPES } from '@/lib/serviceType'
import type { RecordCompleteness, RecordPeriod, RecordSortOrder, RecordGroupBy } from '@/app/actions/medicalRecords'

export type { MedicalRecordRow, RecordScope, BranchOption, StaffOption, RecordGroupBy } from '@/app/actions/medicalRecords'

export interface RecordFiltersState {
  search: string
  completeness: RecordCompleteness
  period: RecordPeriod
  dateFrom: string  // YYYY-MM-DD inclusive — either bound set overrides `period`
  dateTo: string    // YYYY-MM-DD inclusive
  sortOrder: RecordSortOrder
  groupBy: RecordGroupBy
  staffId: string   // 'all' or uuid — team scope only
  branchId: string  // 'all' or uuid — director only
  serviceType: string  // 'all' or a ServiceType value
}

export const DEFAULT_RECORD_FILTERS: RecordFiltersState = {
  search: '',
  completeness: 'incomplete',
  period: '30',
  dateFrom: '',
  dateTo: '',
  sortOrder: 'desc',
  groupBy: 'date',
  staffId: 'all',
  branchId: 'all',
  serviceType: 'all',
}

export const PAGE_SIZE = 10

export type RecordView = 'cards' | 'table'

export const SORT_OPTIONS: { value: RecordGroupBy; label: string }[] = [
  { value: 'date',      label: 'Tanggal' },
  { value: 'patient',   label: 'Nama Pasien' },
  { value: 'therapist', label: 'Nama Terapis' },
]

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

export const SERVICE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Semua Layanan' },
  ...SERVICE_TYPES.map((s) => ({ value: s, label: s })),
]

export function formatRecordDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
