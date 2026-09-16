import type { ServiceType } from '@/types'

export type GriyaVisitFormRoute = 'terapi-awal' | 'session-note'

const ASSESSMENT_TYPES: ServiceType[] = ['TERAPI AWAL']
const SESSION_NOTE_TYPES: ServiceType[] = ['PAKET TERAPI', 'SESI TERAPI']

// Griya Anak's own equivalent of lib/visitRouting.ts's getVisitFormRoute — kept
// separate so griya visits never resolve into the adult MSK assessment/session-note
// forms. 'LAINNYA' / unset deliberately return null (no dedicated form).
export function getGriyaVisitFormRoute(serviceType: string | null | undefined): GriyaVisitFormRoute | null {
  if (!serviceType) return null
  if (ASSESSMENT_TYPES.includes(serviceType as ServiceType)) return 'terapi-awal'
  if (SESSION_NOTE_TYPES.includes(serviceType as ServiceType)) return 'session-note'
  return null
}
