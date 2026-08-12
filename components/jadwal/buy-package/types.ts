export interface BuyPackageDialogProps {
  branchId: string | null
  onClose: () => void
  onSuccess: () => void
}

export const PACKAGE_CATEGORIES = ['PAKET KLINIK', 'PAKET VISIT'] as const
export type PackageCategory = (typeof PACKAGE_CATEGORIES)[number]
