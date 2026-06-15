'use client'

import { Package, AlertTriangle } from 'lucide-react'
import type { PatientPackage } from '@/types'

interface Props {
  packages: PatientPackage[]
  pkgLoading: boolean
  selectedPkgId: string | null
  setSelectedPkgId: (id: string | null) => void
  willCreate: number
}

export function PackageSelector({ packages, pkgLoading, selectedPkgId, setSelectedPkgId, willCreate }: Props) {
  const selectedPkg = packages.find((p) => p.id === selectedPkgId) ?? null
  const remaining   = selectedPkg ? selectedPkg.total_sessions - selectedPkg.used_sessions : null
  const overQuota   = remaining !== null && willCreate > remaining

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-foreground">
        <span className="flex items-center gap-1.5">
          <Package size={11} />
          Paket Sesi <span className="font-normal text-muted-foreground">(opsional)</span>
        </span>
      </label>

      {pkgLoading ? (
        <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
      ) : (
        <select
          value={selectedPkgId ?? ''}
          onChange={(e) => setSelectedPkgId(e.target.value || null)}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer transition-shadow"
        >
          <option value="">— Tanpa Paket —</option>
          {packages.map((pkg) => {
            const rem = pkg.total_sessions - pkg.used_sessions
            const label = `${pkg.package_name} (${pkg.package_type === 'fixed' ? 'Tetap' : 'Fleksibel'}) — ${pkg.used_sessions}/${pkg.total_sessions} · ${rem > 0 ? rem + ' tersisa' : '⚠ habis'}`
            return (
              <option key={pkg.id} value={pkg.id}>
                {pkg.status !== 'active' ? `[${pkg.status}] ` : ''}{label}
              </option>
            )
          })}
        </select>
      )}

      {/* Quota warning */}
      {overQuota && selectedPkg && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 animate-in fade-in duration-200">
          <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-300">Kuota tidak cukup</p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              Membuat {willCreate} sesi, tetapi hanya {Math.max(0, remaining ?? 0)} sesi tersisa pada paket &quot;{selectedPkg.package_name}&quot;.
              Anda tetap bisa menyimpan — ingatkan pasien untuk top up paket.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
