// ABS sheet codes ↔ attendance rows.
//   H = present · <number> = minutes late · I = izin (absent with notice)
//   S = sick · C = paid leave (cuti) · A = alfa (absent without notice)

import type { AttendanceCode, AttendanceSummary } from './types'

export type AttendanceDbStatus = 'present' | 'absent' | 'late' | 'leave' | 'sick' | 'izin'

export interface AttendanceDbRow {
  staff_id: string
  date: string
  status: AttendanceDbStatus
  late_minutes: number | null
}

export const CODE_LABEL: Record<'H' | 'I' | 'S' | 'C' | 'A', string> = {
  H: 'Hadir',
  I: 'Izin',
  S: 'Sakit',
  C: 'Cuti',
  A: 'Alfa',
}

export function codeFromRow(row: Pick<AttendanceDbRow, 'status' | 'late_minutes'>): AttendanceCode {
  switch (row.status) {
    case 'present': return 'H'
    // 'late' rows recorded before minutes were tracked count as 1 minute so
    // they still register as a late day.
    case 'late':    return Math.max(1, row.late_minutes ?? 0)
    case 'izin':    return 'I'
    case 'sick':    return 'S'
    case 'leave':   return 'C'
    case 'absent':  return 'A'
  }
}

export function rowFromCode(code: AttendanceCode): { status: AttendanceDbStatus; late_minutes: number } {
  if (typeof code === 'number') {
    return code > 0 ? { status: 'late', late_minutes: Math.round(code) } : { status: 'present', late_minutes: 0 }
  }
  switch (code) {
    case 'H': return { status: 'present', late_minutes: 0 }
    case 'I': return { status: 'izin',    late_minutes: 0 }
    case 'S': return { status: 'sick',    late_minutes: 0 }
    case 'C': return { status: 'leave',   late_minutes: 0 }
    case 'A': return { status: 'absent',  late_minutes: 0 }
  }
}

/**
 * Parse what HR types into a grid cell. Accepts H/I/S/C/A (any case) or a whole
 * number of minutes late. Returns null for an empty cell, undefined for invalid input.
 */
export function parseCodeInput(raw: string): AttendanceCode | null | undefined {
  const s = raw.trim().toUpperCase()
  if (!s) return null
  if (s === 'H' || s === 'I' || s === 'S' || s === 'C' || s === 'A') return s
  if (/^\d{1,3}$/.test(s)) {
    const n = Number(s)
    if (n > 600) return undefined
    return n === 0 ? 'H' : n
  }
  return undefined
}

export function formatCode(code: AttendanceCode | null): string {
  if (code === null) return ''
  return typeof code === 'number' ? String(code) : code
}

/** ABS!AL:AQ — HADIR = COUNTIF("H") + COUNT(numbers); TLBT = SUM(numbers). */
export function summarizeAttendance(codes: (AttendanceCode | null)[], workdays: number): AttendanceSummary {
  const s: AttendanceSummary = { workdays, hadir: 0, lateDays: 0, lateMinutes: 0, izin: 0, sakit: 0, cuti: 0, alfa: 0 }
  for (const c of codes) {
    if (c === null) continue
    if (typeof c === 'number') {
      s.hadir++
      s.lateDays++
      s.lateMinutes += c
      continue
    }
    if (c === 'H') s.hadir++
    else if (c === 'I') s.izin++
    else if (c === 'S') s.sakit++
    else if (c === 'C') s.cuti++
    else if (c === 'A') s.alfa++
  }
  return s
}
