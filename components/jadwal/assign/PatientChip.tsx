'use client'

import { X, Package } from 'lucide-react'
import type { PatientPlain } from '@/app/actions/patients'
import type { PatientPackage } from '@/types'

interface Props {
  patient: PatientPlain
  packages: PatientPackage[]
  pkgLoading: boolean
  onClear: () => void
}

export function PatientChip({ patient, packages, pkgLoading, onClear }: Props) {
  const activePkgs     = packages.filter((p) => p.status === 'active')
  const totalRemaining = activePkgs.reduce((s, p) => s + Math.max(0, p.total_sessions - p.used_sessions), 0)

  const initials = patient.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/30 transition-all duration-200">
      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{patient.name}</p>
        {patient.phone && (
          <p className="text-xs text-muted-foreground">{patient.phone}</p>
        )}
        {pkgLoading ? (
          <p className="text-xs text-muted-foreground animate-pulse">Memuat paket...</p>
        ) : activePkgs.length > 0 ? (
          <p className="text-xs text-[#34C759] flex items-center gap-1 mt-0.5">
            <Package size={9} />
            {activePkgs.length} paket aktif · {totalRemaining} sesi tersisa
          </p>
        ) : packages.length > 0 ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Package size={9} />
            Tidak ada paket aktif
          </p>
        ) : null}
      </div>
      <button
        onClick={onClear}
        className="p-1 rounded-lg hover:bg-white/10 cursor-pointer text-muted-foreground transition-colors"
        aria-label="Ganti pasien"
      >
        <X size={12} />
      </button>
    </div>
  )
}
