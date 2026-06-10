// ── Date helpers for Jadwal Harian ────────────────────────────────────────────

export const JS_DAY_TO_HARI = ['AHAD', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'] as const

export const HARI_LABEL: Record<string, string> = {
  SENIN: 'Senin', SELASA: 'Selasa', RABU: 'Rabu', KAMIS: 'Kamis',
  JUMAT: 'Jumat', SABTU: 'Sabtu', AHAD: 'Ahad',
}

export const MONTH_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function fmtHeaderDate(d: Date) {
  const hari = HARI_LABEL[JS_DAY_TO_HARI[d.getDay()]] ?? JS_DAY_TO_HARI[d.getDay()]
  return `${hari}, ${d.getDate()} ${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`
}

export function toHariIndonesia(d: Date) {
  return JS_DAY_TO_HARI[d.getDay()]
}
