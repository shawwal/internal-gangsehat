'use client'

import type { PatientPackage } from '@/types'
import { PackageSelector } from '../PackageSelector'

interface Props {
  packages: PatientPackage[]
  pkgLoading: boolean
  selectedPkgId: string | null
  setSelectedPkgId: (id: string | null) => void
}

// Reuses the existing PackageSelector <select> as the single source of truth
// for "list this patient's packages" — no markup duplicated here.
export function ExistingPackagePicker({ packages, pkgLoading, selectedPkgId, setSelectedPkgId }: Props) {
  return (
    <PackageSelector
      packages={packages}
      pkgLoading={pkgLoading}
      selectedPkgId={selectedPkgId}
      setSelectedPkgId={setSelectedPkgId}
      willCreate={0}
    />
  )
}
