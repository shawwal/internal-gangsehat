import type { VisitStatus } from '@/types'

export const STATUS_OPTIONS: { value: VisitStatus; label: string }[] = [
  { value: 'scheduled', label: 'Terjadwal' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Batal' },
  { value: 'no_show',   label: 'Tidak Hadir' },
]

// SEN=1, SEL=2, RAB=3, KAM=4, JUM=5, SAB=6, MIN=0
export const DAY_CHIPS = [
  { dow: 1, label: 'SEN' },
  { dow: 2, label: 'SEL' },
  { dow: 3, label: 'RAB' },
  { dow: 4, label: 'KAM' },
  { dow: 5, label: 'JUM' },
  { dow: 6, label: 'SAB' },
  { dow: 0, label: 'MIN' },
]

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fmtHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00 – ${String(h + 1).padStart(2, '0')}:00`
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
