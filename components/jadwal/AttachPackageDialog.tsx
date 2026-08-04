'use client'

import { useEffect, useState } from 'react'
import { Link2, AlertTriangle, Loader2 } from 'lucide-react'
import { attachVisitToPackage } from '@/app/actions/jadwal'
import { fetchPatientPackages } from '@/app/actions/packages'
import { PackageSelector } from './assign/PackageSelector'
import type { DailyVisit } from './types'
import type { PatientPackage } from '@/types'

interface Props {
  visit: DailyVisit
  onClose: () => void
  onAttached: (visitId: string) => void
}

export function AttachPackageDialog({ visit, onClose, onAttached }: Props) {
  const [packages, setPackages]     = useState<PatientPackage[]>([])
  const [pkgLoading, setPkgLoading] = useState(true)
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    fetchPatientPackages(visit.patient_id).then((pkgs) => {
      setPackages(pkgs)
      setSelectedPkgId(pkgs.find((p) => p.status === 'active')?.id ?? null)
      setPkgLoading(false)
    })
  }, [visit.patient_id])

  async function handleConfirm() {
    if (submitting || !selectedPkgId) return
    setSubmitting(true)
    setError(null)
    const result = await attachVisitToPackage(visit.id, selectedPkgId)
    setSubmitting(false)
    if (result.error) { setError(result.error); return }
    onAttached(visit.id)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Link2 size={16} className="text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Gunakan Paket</p>
            <p className="text-xs text-muted-foreground truncate">{visit.patient_name}</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Hubungkan kunjungan ini ke salah satu paket milik pasien — sesi akan dipotong dari
            paket tersebut alih-alih dibayar terpisah.
          </p>

          <PackageSelector
            packages={packages}
            pkgLoading={pkgLoading}
            selectedPkgId={selectedPkgId}
            setSelectedPkgId={setSelectedPkgId}
            willCreate={1}
          />

          {!pkgLoading && packages.length === 0 && (
            <p className="text-xs text-muted-foreground bg-white/5 px-3 py-2.5 rounded-xl">
              Pasien belum memiliki paket.
            </p>
          )}

          {visit.has_payment && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                Kunjungan ini sudah memiliki pembayaran terpisah. Pastikan tidak terjadi dobel tagihan.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-destructive/8 border border-destructive/20">
              <AlertTriangle size={13} className="text-destructive shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !selectedPkgId}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-70 transition-colors cursor-pointer"
          >
            {submitting
              ? <><Loader2 size={14} className="animate-spin" /> Menyimpan...</>
              : 'Gunakan Paket Ini'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
