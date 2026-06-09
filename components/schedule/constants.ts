import type { ScheduleForm, WeeklyPattern } from './types'

export const HARI_LIST = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'AHAD'] as const
export const SHIFT_LIST = ['PAGI', 'SORE'] as const
export const PAGE_SIZES = [10, 25, 50] as const

export const SHIFT_HOURS: Record<string, { jam_mulai: string; jam_selesai: string }> = {
  PAGI: { jam_mulai: '08:00', jam_selesai: '15:00' },
  SORE: { jam_mulai: '13:00', jam_selesai: '20:00' },
}

export const EMPTY_FORM: ScheduleForm = {
  staff_id:    '',
  branch_id:   '',
  hari:        ['SENIN'],
  shift:       'PAGI',
  jam_mulai:   '08:00',
  jam_selesai: '15:00',
  status:      'AKTIF',
  notes:       '',
}

export function buildEmptyWeekly(): WeeklyPattern {
  return Object.fromEntries(
    HARI_LIST.map((h) => [
      h,
      { enabled: false, shift: 'PAGI', jam_mulai: '08:00', jam_selesai: '15:00', status: 'AKTIF' as const },
    ]),
  )
}
