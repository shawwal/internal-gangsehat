import type { ShiftValue } from '@/lib/shift/rollingShift'

export interface StaffOption {
  id: string
  full_name: string
  branch_id?: string | null
}

export interface PatternFormState {
  code: 'X' | 'Y'
  name: string
  senin: ShiftValue
  selasa: ShiftValue
  rabu: ShiftValue
  kamis: ShiftValue
  jumat: ShiftValue
  sabtu: ShiftValue
}

export interface TeamFormState {
  name: 'A' | 'B'
  pola_x_id: string
  pola_y_id: string
  anchor_date: string
}

export const DAY_KEYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'] as const
export const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
  senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu', kamis: 'Kamis', jumat: 'Jumat', sabtu: 'Sabtu',
}

export const EMPTY_PATTERN_FORM: PatternFormState = {
  code: 'X', name: '',
  senin: 'PAGI', selasa: 'PAGI', rabu: 'SORE', kamis: 'SORE', jumat: 'PAGI', sabtu: 'SORE',
}
