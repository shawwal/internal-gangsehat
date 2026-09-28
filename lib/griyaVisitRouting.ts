import type { ServiceType } from '@/types'

export type GriyaVisitFormRoute = 'terapi-awal' | 'session-note'
export type GriyaRmType = 'DEFAULT' | 'FISIOTERAPI' | 'PSIKOLOG'

// Which intake form a Griya Anak Terapi Awal uses, derived from the discipline
// the visit belongs to. Terapi Wicara / Perilaku / unknown keep the default form.
export function disciplineToRmType(discipline: string | null | undefined): GriyaRmType {
  if (discipline === 'FISIOTERAPI') return 'FISIOTERAPI'
  if (discipline === 'PSIKOLOG') return 'PSIKOLOG'
  return 'DEFAULT'
}

// 'TA VISIT' (home-visit Terapi Awal) is deliberately included here even though
// the adult router (lib/visitRouting.ts) keeps it on the lightweight quick-edit
// modal instead — a griya home-visit intake is clinically the same pediatric
// assessment as a klinik one, and griya has no adult-style quick modal to fall
// back to, so it must always reach the full intake form.
const ASSESSMENT_TYPES: ServiceType[] = ['TERAPI AWAL', 'TA VISIT']
const SESSION_NOTE_TYPES: ServiceType[] = ['PAKET TERAPI', 'SESI TERAPI', 'SESI VISIT', 'PAKET VISIT']

// Griya Anak's own equivalent of lib/visitRouting.ts's getVisitFormRoute — kept
// separate so griya visits never resolve into the adult MSK assessment/session-note
// forms. 'LAINNYA' / unset return null (no dedicated form) — except PSIKOLOG
// visits: psikolog services (Konsultasi Psikolog, psikotest, …) are catalogued
// as LAINNYA, and each consultation gets its own Rekam Medis Psikolog, so they
// route to the intake form.
export function getGriyaVisitFormRoute(
  serviceType: string | null | undefined,
  discipline?: string | null,
): GriyaVisitFormRoute | null {
  if (discipline === 'PSIKOLOG' && (!serviceType || serviceType === 'LAINNYA')) return 'terapi-awal'
  if (!serviceType) return null
  if (ASSESSMENT_TYPES.includes(serviceType as ServiceType)) return 'terapi-awal'
  if (SESSION_NOTE_TYPES.includes(serviceType as ServiceType)) return 'session-note'
  return null
}
