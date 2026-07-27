import type { ServiceType } from '@/types'

export type VisitFormRoute = 'assessment' | 'session-note'

const ASSESSMENT_TYPES: ServiceType[] = ['TERAPI AWAL']
const SESSION_NOTE_TYPES: ServiceType[] = ['SESI TERAPI', 'PAKET TERAPI', 'SESI VISIT', 'PAKET VISIT']

// Visit types where regio (body region) is compulsory — everything else treats it as optional.
const REGIO_REQUIRED_TYPES: ServiceType[] = ['TERAPI AWAL', 'TA VISIT']

export function isRegioRequired(serviceType: string | null | undefined): boolean {
  if (!serviceType) return false
  return REGIO_REQUIRED_TYPES.includes(serviceType as ServiceType)
}

// TA VISIT / LAINNYA / unset deliberately return null — they stay on the lightweight
// MedicalRecordModal instead of a dedicated full-page form.
export function getVisitFormRoute(serviceType: string | null | undefined): VisitFormRoute | null {
  if (!serviceType) return null
  if (ASSESSMENT_TYPES.includes(serviceType as ServiceType)) return 'assessment'
  if (SESSION_NOTE_TYPES.includes(serviceType as ServiceType)) return 'session-note'
  return null
}
