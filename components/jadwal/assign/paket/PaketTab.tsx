'use client'

import { Package } from 'lucide-react'
import type { PatientPackage } from '@/types'
import type { LayananRow } from '@/app/actions/layanan'
import type { PaketSubMode } from './types'
import { SubModeToggle } from './SubModeToggle'
import { LayananPicker } from './LayananPicker'
import { ExistingPackagePicker } from './ExistingPackagePicker'

interface Props {
  branchId: string | null
  packages: PatientPackage[]
  pkgLoading: boolean
  subMode: PaketSubMode
  setSubMode: (m: PaketSubMode) => void
  selectedLayanan: LayananRow | null
  onSelectLayanan: (layanan: LayananRow) => void
  selectedPkgId: string | null
  onSelectExistingPkg: (id: string | null) => void
}

export function PaketTab({
  branchId,
  packages,
  pkgLoading,
  subMode,
  setSubMode,
  selectedLayanan,
  onSelectLayanan,
  selectedPkgId,
  onSelectExistingPkg,
}: Props) {
  return (
    <div className="space-y-3">
      <SubModeToggle subMode={subMode} setSubMode={setSubMode} />

      {subMode === 'baru' ? (
        <LayananPicker branchId={branchId} selected={selectedLayanan} onSelect={onSelectLayanan} />
      ) : (
        <ExistingPackagePicker
          packages={packages}
          pkgLoading={pkgLoading}
          selectedPkgId={selectedPkgId}
          setSelectedPkgId={onSelectExistingPkg}
        />
      )}

      {subMode === 'baru' && selectedLayanan && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
          <Package size={12} className="text-primary shrink-0" />
          <span className="text-xs font-semibold text-primary">Dipilih: {selectedLayanan.nama}</span>
        </div>
      )}
    </div>
  )
}
