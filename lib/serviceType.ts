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

// Branch price-list kategori (internal_layanan.kategori), in display order.
export const LAYANAN_KATEGORI = [
  'TA KLINIK', 'SESI KLINIK', 'PAKET KLINIK',
  'TA VISIT', 'SESI VISIT', 'PAKET VISIT', 'SPORT MASSAGE', 'PAKET SPORT MASSAGE', 'LAINNYA',
]

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

// Categories a patient_packages row (and its income transactions) can carry.
export const PACKAGE_CATEGORIES = ['PAKET KLINIK', 'PAKET VISIT', 'PAKET SPORT MASSAGE'] as const
export type PackageCategory = typeof PACKAGE_CATEGORIES[number]

export function isPackageCategory(c: string | null | undefined): c is PackageCategory {
  return (PACKAGE_CATEGORIES as readonly string[]).includes(c ?? '')
}

/** Package category for a branch price-list kategori (internal_layanan.kategori),
 *  or null when the layanan isn't a package. */
export function packageCategoryForKategori(kategori: string | null | undefined): PackageCategory | null {
  const k = (kategori ?? '').toUpperCase()
  if (!k.includes('PAKET')) return null
  if (k.includes('SPORT MASSAGE')) return 'PAKET SPORT MASSAGE'
  if (k.includes('VISIT')) return 'PAKET VISIT'
  return 'PAKET KLINIK'
}
