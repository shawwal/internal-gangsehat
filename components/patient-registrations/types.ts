import type { RegistrationStatus, RegistrationType } from '@/app/actions/patientRegistrations'

export const PAGE_SIZE = 10

export type StatusFilter = RegistrationStatus | 'all'
export type TypeFilter = RegistrationType | 'all'

export interface RegistrationFilterState {
  search: string
  status: StatusFilter
  type: TypeFilter
  branchId: string // 'all' or uuid (director only)
}

export const DEFAULT_FILTERS: RegistrationFilterState = {
  search: '',
  status: 'pending',
  type: 'all',
  branchId: 'all',
}

export const STATUS_LABEL: Record<RegistrationStatus, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
}

export const TYPE_LABEL: Record<TypeFilter, string> = {
  all: 'Semua Jenis',
  umum: 'Pasien Umum',
  griya: 'Griya Anak',
}

export const STATUS_COLOR: Record<RegistrationStatus, string> = {
  pending: 'bg-secondary/20 text-secondary-foreground',
  approved: 'bg-chart-4/15 text-chart-4',
  rejected: 'bg-destructive/10 text-destructive',
}

export const STATUS_BORDER: Record<RegistrationStatus, string> = {
  pending: 'border-l-secondary',
  approved: 'border-l-chart-4',
  rejected: 'border-l-destructive',
}

export const GENDER_LABEL: Record<string, string> = {
  male: 'Laki-laki',
  female: 'Perempuan',
  other: 'Lainnya',
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function formatBirthDate(v: string) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}
