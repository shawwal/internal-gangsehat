// Payroll period builder (replaces the TEMP sheet).
// A period for month N runs from `startDay` of month N−1 to the day before
// `startDay` of month N (27 Aug → 26 Sep for September with startDay = 27).
// Start days past the end of a short month clamp to its last day, so periods
// never overlap or leave gaps, including across leap years.

import type { PeriodDay, Weekday } from './types'

const WEEKDAYS: Weekday[] = ['AHAD', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU']
const SHORT: Record<Weekday, string> = {
  AHAD: 'MIN', SENIN: 'SEN', SELASA: 'SEL', RABU: 'RAB', KAMIS: 'KAM', JUMAT: 'JUM', SABTU: 'SAB',
}

export const WEEKDAY_OPTIONS: Weekday[] = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'AHAD']

export const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function weekdayOf(isoDate: string): Weekday {
  return WEEKDAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()]
}

/** "KAM", "JUM", … — the TEMP sheet's localized day headers. */
export function shortDayLabel(isoDate: string): string {
  return SHORT[weekdayOf(isoDate)]
}

/** First day of the period that pays out in (year, month). */
function periodStart(year: number, month: number, startDay: number): string {
  if (startDay <= 1) return iso(year, month, 1)
  const py = month === 1 ? year - 1 : year
  const pm = month === 1 ? 12 : month - 1
  return iso(py, pm, Math.min(startDay, lastDayOfMonth(py, pm)))
}

export function periodRange(year: number, month: number, startDay: number): { start: string; end: string } {
  const start = periodStart(year, month, startDay)
  const ny = month === 12 ? year + 1 : year
  const nm = month === 12 ? 1 : month + 1
  const end = addDays(periodStart(ny, nm, startDay), -1)
  return { start, end }
}

export interface BuildPeriodOptions {
  startDay: number
  weeklyOffDays: Weekday[]
  holidays: { date: string; name: string }[]
}

export function buildPeriodDays(year: number, month: number, opts: BuildPeriodOptions): {
  start: string
  end: string
  days: PeriodDay[]
  workdays: number
} {
  const { start, end } = periodRange(year, month, opts.startDay)
  const off = new Set(opts.weeklyOffDays)
  const holidayByDate = new Map(opts.holidays.map((h) => [h.date, h.name]))
  const days: PeriodDay[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const holiday = holidayByDate.get(d)
    if (holiday) days.push({ date: d, workday: false, note: holiday })
    else if (off.has(weekdayOf(d))) days.push({ date: d, workday: false, note: null })
    else days.push({ date: d, workday: true, note: null })
  }
  return { start, end, days, workdays: countWorkdays(days) }
}

export function countWorkdays(days: PeriodDay[]): number {
  return days.filter((d) => d.workday).length
}

export function periodLabel(year: number, month: number): string {
  return `Periode ${MONTH_NAMES[month - 1]} ${year}`
}
