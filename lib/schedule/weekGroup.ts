// Determines which biweekly "minggu" (week) a date falls into, using ISO
// week-number parity so it stays consistent across month boundaries.

export type WeekGroup = 'SEMUA' | 'MINGGU_1' | 'MINGGU_2'

export const WEEK_GROUP_LIST: WeekGroup[] = ['SEMUA', 'MINGGU_1', 'MINGGU_2']

export const WEEK_GROUP_LABEL: Record<WeekGroup, string> = {
  SEMUA:    'Setiap Minggu',
  MINGGU_1: 'Minggu 1',
  MINGGU_2: 'Minggu 2',
}

export function getIsoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7 // Mon=0 .. Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  const diff = date.getTime() - firstThursday.getTime()
  return 1 + Math.round(diff / (7 * 24 * 3600 * 1000))
}

export function getWeekGroupForDate(d: Date): 'MINGGU_1' | 'MINGGU_2' {
  return getIsoWeekNumber(d) % 2 === 1 ? 'MINGGU_1' : 'MINGGU_2'
}
