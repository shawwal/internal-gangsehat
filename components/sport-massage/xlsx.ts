import type { CellObject } from 'xlsx'

export type Cell = CellObject | string | number | null

/** YYYY-MM-DD → Excel serial date (timezone-free, so it never shifts a day). */
export function dateCell(iso: string): CellObject | string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const serial = (Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86_400_000
  return { t: 'n', v: serial, z: 'dd/mm/yyyy' }
}

export const money = (v: number): CellObject => ({ t: 'n', v, z: '#,##0' })

export function slug(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export const VISIT_STATUS_LABEL: Record<string, string> = {
  scheduled: 'Terjadwal', completed: 'Selesai', cancelled: 'Dibatalkan', no_show: 'Tidak Datang',
}

export function kehadiranLabel(k: string | null): string {
  if (k === 'HADIR') return 'Hadir'
  if (k === 'TIDAK HADIR') return 'Tidak Hadir'
  return k ?? 'Belum Diisi'
}
