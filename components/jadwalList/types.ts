import type { JadwalListRow, AdminStatus } from '@/app/actions/jadwalList'

export type { JadwalListRow, AdminStatus }

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const
export const DEFAULT_PAGE_SIZE = 10

export const STATUS_LABEL: Record<AdminStatus, string> = {
  BELUM_DIPERIKSA: 'Belum Diperiksa',
  BELUM_DITANGANI: 'Belum Ditangani',
  LENGKAP:         'Lengkap',
}

export const STATUS_BADGE: Record<AdminStatus, string> = {
  BELUM_DIPERIKSA: 'bg-blue-500/15 text-blue-500 border border-blue-500/25',
  BELUM_DITANGANI: 'bg-blue-500/15 text-blue-500 border border-blue-500/25',
  LENGKAP:         'bg-[#34C759]/15 text-[#34C759] border border-[#34C759]/25',
}

export const TIPE_ORDER_LABEL = 'reguler'

export function formatShortDate(d: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00') : new Date(d)
  if (isNaN(date.getTime())) return '—'
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}
