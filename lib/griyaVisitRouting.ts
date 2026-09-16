import type { ServiceType } from '@/types'

export type GriyaVisitFormRoute = 'terapi-awal' | 'session-note'

// 'TA VISIT' (home-visit Terapi Awal) is deliberately included here even though
// the adult router (lib/visitRouting.ts) keeps it on the lightweight quick-edit
// modal instead — a griya home-visit intake is clinically the same pediatric
// assessment as a klinik one, and griya has no adult-style quick modal to fall
// back to, so it must always reach the full intake form.
const ASSESSMENT_TYPES: ServiceType[] = ['TERAPI AWAL', 'TA VISIT']
const SESSION_NOTE_TYPES: ServiceType[] = ['PAKET TERAPI', 'SESI TERAPI', 'SESI VISIT', 'PAKET VISIT']

// Griya Anak's own equivalent of lib/visitRouting.ts's getVisitFormRoute — kept
// separate so griya visits never resolve into the adult MSK assessment/session-note
// forms. 'LAINNYA' / unset deliberately return null (no dedicated form).
export function getGriyaVisitFormRoute(serviceType: string | null | undefined): GriyaVisitFormRoute | null {
  if (!serviceType) return null
  if (ASSESSMENT_TYPES.includes(serviceType as ServiceType)) return 'terapi-awal'
  if (SESSION_NOTE_TYPES.includes(serviceType as ServiceType)) return 'session-note'
  return null
}
