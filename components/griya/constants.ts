import type { Discipline, Hari } from '@/app/actions/griyaJadwal'

// Griya Anak operates a flat hourly grid 08:00–17:00 (no PAGI/SORE split).
// Configurable later — kept here as a single source.
export const GRIYA_HOURS: string[] = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00',
]

export const HARI_ORDER: Hari[] = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'AHAD']

export const HARI_LABEL: Record<Hari, string> = {
  SENIN: 'Senin', SELASA: 'Selasa', RABU: 'Rabu', KAMIS: 'Kamis',
  JUMAT: 'Jumat', SABTU: 'Sabtu', AHAD: 'Ahad',
}

export const JS_DAY_TO_HARI: Hari[] = ['AHAD', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU']

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  FISIOTERAPI: 'Fisioterapi',
  TERAPI_WICARA: 'Terapi Wicara',
  TERAPI_PERILAKU: 'Terapi Perilaku',
  PSIKOLOG: 'Psikolog',
}

export const DISCIPLINE_SHORT: Record<Discipline, string> = {
  FISIOTERAPI: 'FT', TERAPI_WICARA: 'TW', TERAPI_PERILAKU: 'BT', PSIKOLOG: 'PSI',
}

export const DISCIPLINES: Discipline[] = ['FISIOTERAPI', 'TERAPI_WICARA', 'TERAPI_PERILAKU', 'PSIKOLOG']

export const ABSENCE_REASONS = ['SAKIT', 'IZIN', 'ALPA', 'LIBUR'] as const

export function hariOf(d: Date): Hari {
  return JS_DAY_TO_HARI[d.getDay()]
}

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getMondayOf(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const r = new Date(d)
  r.setDate(r.getDate() + diff)
  return r
}
