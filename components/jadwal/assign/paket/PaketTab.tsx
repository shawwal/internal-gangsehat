'use client'

import { Package, PackagePlus } from 'lucide-react'
import type { LayananRow } from '@/app/actions/layanan'
import type { PatientPackage } from '@/types'
import { LayananPicker } from './LayananPicker'
import { ExistingPackagePicker } from './ExistingPackagePicker'
import type { PaketSubMode } from './types'

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

const TABS: { value: PaketSubMode; label: string; icon: React.ReactNode }[] = [
  { value: 'baru',  label: 'Buat Baru',   icon: <PackagePlus size={12} /> },
  { value: 'pilih', label: 'Pilih Paket', icon: <Package size={12} /> },
]

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
      <div className="flex gap-1.5 p-1 rounded-xl bg-white/5 border border-border/30">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setSubMode(tab.value)}
            className={[
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer',
              subMode === tab.value
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
            ].join(' ')}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {subMode === 'baru' ? (
        <div className="space-y-3">
          <LayananPicker branchId={branchId} selected={selectedLayanan} onSelect={onSelectLayanan} />

          {selectedLayanan && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
              <Package size={12} className="text-primary shrink-0" />
              <span className="text-xs font-semibold text-primary">Dipilih: {selectedLayanan.nama}</span>
            </div>
          )}
        </div>
      ) : pkgLoading ? (
        <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
      ) : packages.length > 0 ? (
        <ExistingPackagePicker
          packages={packages}
          pkgLoading={pkgLoading}
          selectedPkgId={selectedPkgId}
          setSelectedPkgId={onSelectExistingPkg}
        />
      ) : (
        <p className="text-xs text-muted-foreground bg-white/5 px-3 py-2.5 rounded-xl">
          Pasien belum memiliki paket.
        </p>
      )}
    </div>
  )
}
