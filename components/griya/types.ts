import type { Discipline, Hari, GriyaSlot, GriyaWeekVisit } from '@/app/actions/griyaJadwal'

/** Identifies a grid cell the user acted on. */
export interface CellTarget {
  therapistId: string
  therapistName: string
  discipline: Discipline
  hari: Hari
  hour: string        // 'HH:MM'
  dateIso: string
  branchId: string
  slot?: GriyaSlot | null
  visit?: GriyaWeekVisit | null
}

export const GRIYA_SERVICE_TYPES = ['TERAPI AWAL', 'PAKET TERAPI', 'SESI TERAPI', 'LAINNYA'] as const
