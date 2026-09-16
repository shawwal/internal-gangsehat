import type { Discipline, Hari, GriyaSlot, GriyaWeekVisit } from '@/app/actions/griyaJadwal'
import { SERVICE_TYPES } from '@/lib/serviceType'

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

// Griya can use any of the catalog's service types (klinik or home-visit variants,
// via the branch's internal_layanan catalog — see AssignStudentDialog) — this used
// to be a hand-picked subset that silently dropped TA/SESI/PAKET VISIT rows from the
// weekly grid and dropdowns. Re-export the canonical list so it can't drift again.
export const GRIYA_SERVICE_TYPES = SERVICE_TYPES
