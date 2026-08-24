import type { ServiceType } from '@/types'

export const SERVICE_TYPES: ServiceType[] = [
  'TERAPI AWAL', 'PAKET TERAPI', 'SESI TERAPI',
  'TA VISIT', 'SESI VISIT', 'PAKET VISIT', 'SPORT MASSAGE', 'LAINNYA',
]

export const SERVICE_TO_CATEGORY: Record<ServiceType, string> = {
  'TERAPI AWAL':  'TA KLINIK',
  'SESI TERAPI':  'SESI KLINIK',
  'PAKET TERAPI': 'PAKET KLINIK',
  'TA VISIT':     'TA VISIT',
  'SESI VISIT':   'SESI VISIT',
  'PAKET VISIT':  'PAKET VISIT',
  'SPORT MASSAGE': 'SPORT MASSAGE',
  'LAINNYA':      'LAINNYA',
}

// SERVICE_TO_CATEGORY's values are all distinct, so this reverse lookup is well-defined —
// lets a Kategori control drive the paired Layanan value (and vice versa).
export const CATEGORY_TO_SERVICE_TYPE: Record<string, ServiceType> = Object.fromEntries(
  SERVICE_TYPES.map((s) => [SERVICE_TO_CATEGORY[s], s]),
)

// Package sessions can be stored with a literal service_type of 'SESI TERAPI'/'SESI VISIT'
// even though package_id is set (depends on which flow created the visit — AssignDialog vs
// PackageSessionWizard). package_id is the source of truth: normalize the label to the
// PAKET variant, mirroring VisitCard.tsx's precedence.
export function getEffectivePackageServiceType(
  serviceType: string | null, packageId?: string | null,
): ServiceType | null {
  if (packageId) {
    if (serviceType === 'SESI TERAPI') return 'PAKET TERAPI'
    if (serviceType === 'SESI VISIT')  return 'PAKET VISIT'
  }
  return serviceType as ServiceType | null
}
