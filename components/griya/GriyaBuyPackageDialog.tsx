'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { LayananRow } from '@/app/actions/layanan'
import { createPackageFromLayanan } from '@/app/actions/packages'
import { LayananPicker } from '@/components/jadwal/assign/paket/LayananPicker'
import { PaketPaymentStep } from '@/components/jadwal/assign/paket/PaketPaymentStep'

interface Props {
  patientId: string
  patientName: string
  branchId: string
  onClose: () => void
  /** Fired once the package row exists (payment may still be pending). */
  onDone: (packageId: string) => void
}

export function GriyaBuyPackageDialog({ patientId, patientName, branchId, onClose, onDone }: Props) {
  const [layanan, setLayanan] = useState<LayananRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ id: string; layanan: LayananRow } | null>(null)

  async function createPkg() {
    if (!layanan) return
    setCreating(true); setError(null)
    const category = layanan.kategori.includes('VISIT') ? 'PAKET VISIT' : 'PAKET KLINIK'
    const { id, error } = await createPackageFromLayanan({ patient_id: patientId, branch_id: branchId, layanan_id: layanan.id, category })
    setCreating(false)
    if (error || !id) { setError(error ?? 'Gagal membuat paket.'); return }
    setCreated({ id, layanan })
  }

  if (created) {
    return (
      <PaketPaymentStep
        patientId={patientId}
        patientName={patientName}
        packageId={created.id}
        packageName={created.layanan.nama}
        jumlahSesi={created.layanan.jumlah_sesi ?? 1}
        hargaDefault={created.layanan.harga}
        category={created.layanan.kategori.includes('VISIT') ? 'PAKET VISIT' : 'PAKET KLINIK'}
        branchId={branchId}
        onDone={() => onDone(created.id)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-md max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Beli Paket — {patientName.split(' ')[0]}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Pilih paket dari daftar layanan cabang.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        <LayananPicker branchId={branchId} selected={layanan} onSelect={setLayanan} />

        {error && <p className="text-xs text-destructive mt-2">{error}</p>}

        <div className="flex gap-2 pt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">Batal</button>
          <button onClick={createPkg} disabled={!layanan || creating}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
            {creating ? 'Membuat...' : 'Lanjut ke pembayaran'}
          </button>
        </div>
      </div>
    </div>
  )
}
