import type { ServiceType } from '@/types'

export const SERVICE_TYPES: ServiceType[] = [
  'TERAPI AWAL KLINIK', 'PAKET KLINIK', 'SESI KLINIK',
  'TERAPI AWAL VISIT', 'SESI VISIT', 'PAKET VISIT', 'SPORT MASSAGE', 'LAINNYA',
]

// A visit's service type and the income category it is paid under are the same
// word (migration 119 — the Tarif Layanan kategori names). Kept as a map so call
// sites read as "category for this visit".
export const SERVICE_TO_CATEGORY = Object.fromEntries(
  SERVICE_TYPES.map((s) => [s, s]),
) as Record<ServiceType, string>

// Branch price-list kategori (internal_layanan.kategori), in display order.
export const LAYANAN_KATEGORI = [
  'TERAPI AWAL KLINIK', 'SESI KLINIK', 'PAKET KLINIK',
  'TERAPI AWAL VISIT', 'SESI VISIT', 'PAKET VISIT', 'SPORT MASSAGE', 'PAKET SPORT MASSAGE', 'LAINNYA',
]

// Income categories that never come from a branch price list: TOKO is written
// by /toko sales, LAINNYA is free-form. Every other income category must have an
// active internal_layanan row in the branch to be billable.
export const SYSTEM_INCOME_CATEGORIES = ['TOKO'] as const
export const FREE_INCOME_CATEGORIES = ['LAINNYA'] as const

export function isPriceListExempt(category: string | null | undefined): boolean {
  const c = category ?? ''
  return (SYSTEM_INCOME_CATEGORIES as readonly string[]).includes(c)
    || (FREE_INCOME_CATEGORIES as readonly string[]).includes(c)
}

/** Income kategori a branch can bill — those with an active price-list row, in
 *  LAYANAN_KATEGORI order — plus the free-form categories. */
export function branchIncomeKategori(layanan: { kategori: string; is_active: boolean }[]): string[] {
  const active = new Set(layanan.filter((l) => l.is_active).map((l) => l.kategori))
  const priced = LAYANAN_KATEGORI.filter((k) => active.has(k) && !isPriceListExempt(k))
  // Kategori added from Tarif Layanan (income_categories) after the built-in ones.
  const added = [...active].filter((k) => !LAYANAN_KATEGORI.includes(k) && !isPriceListExempt(k)).sort()
  return [...priced, ...added, ...FREE_INCOME_CATEGORIES]
}

// Reverse of SERVICE_TO_CATEGORY — lets a Kategori control drive the paired Layanan
// value (and vice versa).
export const CATEGORY_TO_SERVICE_TYPE: Record<string, ServiceType> = Object.fromEntries(
  SERVICE_TYPES.map((s) => [SERVICE_TO_CATEGORY[s], s]),
)

// Package sessions can be stored with a literal service_type of 'SESI KLINIK'/'SESI VISIT'
// even though package_id is set (depends on which flow created the visit — AssignDialog vs
// PackageSessionWizard). package_id is the source of truth: normalize the label to the
// PAKET variant, mirroring VisitCard.tsx's precedence.
export function getEffectivePackageServiceType(
  serviceType: string | null, packageId?: string | null,
): ServiceType | null {
  if (packageId) {
    if (serviceType === 'SESI KLINIK') return 'PAKET KLINIK'
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
