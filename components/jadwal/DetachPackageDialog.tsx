'use client'

import { useState } from 'react'
import { Unlink, AlertTriangle, Loader2 } from 'lucide-react'
import { detachVisitFromPackage } from '@/app/actions/jadwal'
import type { DailyVisit } from './types'

const SERVICE_TYPES = ['TERAPI AWAL', 'SESI TERAPI', 'TA VISIT', 'SESI VISIT', 'LAINNYA'] as const

interface Props {
  visit: DailyVisit
  onClose: () => void
  onDetached: (visitId: string, newServiceType: string) => void
}

export function DetachPackageDialog({ visit, onClose, onDetached }: Props) {
  const [serviceType, setServiceType] = useState<string>(
    visit.service_type?.includes('VISIT') ? 'SESI VISIT' : 'SESI TERAPI',
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const isCompleted = visit.status === 'completed'

  async function handleConfirm() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const result = await detachVisitFromPackage(visit.id, serviceType)
    setSubmitting(false)
    if (result.error) { setError(result.error); return }
    onDetached(visit.id, serviceType)
  }

  const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Unlink size={16} className="text-[#FFB35C] shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Lepas dari Paket</p>
            <p className="text-xs text-muted-foreground truncate">{visit.patient_name}</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Kunjungan ini akan dilepas dari paketnya dan menjadi sesi mandiri yang bisa dibayar
            terpisah. Gunakan ini jika kunjungan salah terhubung ke paket, atau pasien memilih
            membayar sesi ini sendiri alih-alih memakai jatah paket.
          </p>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Ubah Layanan Menjadi</label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className={inputCls + ' cursor-pointer'}
            >
              {SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

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
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-70 transition-colors cursor-pointer"
          >
            {submitting
              ? <><Loader2 size={14} className="animate-spin" /> Menyimpan...</>
              : (isCompleted ? 'Lepas & Catat Pembayaran' : 'Lepas dari Paket')
            }
          </button>
        </div>
      </div>
    </div>
  )
}
