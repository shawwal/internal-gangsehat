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

// Per-discipline colour coding for schedule headers (mirrors the printed sheet).
// Greens/reds are avoided — those belong to attendance states in SlotCell.
export const DISCIPLINE_COLOR: Record<Discipline, { band: string; tint: string; bar: string; dot: string }> = {
  FISIOTERAPI:     { band: 'bg-[#FF0090] text-white', tint: 'bg-[#FF0090]/10', bar: 'border-[#FF0090]', dot: 'bg-[#FF0090]' },
  TERAPI_WICARA:   { band: 'bg-[#F59E0B] text-white', tint: 'bg-[#F59E0B]/10', bar: 'border-[#F59E0B]', dot: 'bg-[#F59E0B]' },
  TERAPI_PERILAKU: { band: 'bg-[#6366F1] text-white', tint: 'bg-[#6366F1]/10', bar: 'border-[#6366F1]', dot: 'bg-[#6366F1]' },
  PSIKOLOG:        { band: 'bg-[#0EA5E9] text-white', tint: 'bg-[#0EA5E9]/10', bar: 'border-[#0EA5E9]', dot: 'bg-[#0EA5E9]' },
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
