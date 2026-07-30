'use client'

import { useState } from 'react'
import { X, Package, Trash2 } from 'lucide-react'
import { deletePatientPackage } from '@/app/actions/packages'
import { ConfirmDialog } from '@/components/leave/ConfirmDialog'
import type { PatientPackage } from '@/types'

interface Props {
  patientName: string
  packages: PatientPackage[]
  onClose: () => void
  onChanged: () => void
}

const STATUS_LABEL: Record<string, string> = {
  active:    'Aktif',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}

export function ManagePackagesDialog({ patientName, packages, onClose, onChanged }: Props) {
  const [target, setTarget]   = useState<PatientPackage | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [result, setResult]   = useState<string | null>(null)

  async function handleConfirm() {
    if (!target) return
    setDeleting(true)
    const { error, hardDeleted } = await deletePatientPackage(target.id)
    setDeleting(false)
    setTarget(null)
    if (error) {
      setResult(`Gagal: ${error}`)
      return
    }
    setResult(hardDeleted ? 'Paket dihapus.' : 'Paket dibatalkan (sudah punya riwayat).')
    onChanged()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[70] p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <p className="text-sm font-semibold text-foreground">Kelola Paket</p>
            <p className="text-xs text-muted-foreground">{patientName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {result && (
            <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-xl">{result}</p>
          )}

          {packages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Belum ada paket.</p>
          ) : (
            packages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border"
              >
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Package size={14} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{pkg.package_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {pkg.category ?? '—'} · {pkg.used_sessions}/{pkg.total_sessions} sesi · {STATUS_LABEL[pkg.status] ?? pkg.status}
                  </p>
                </div>
                <button
                  onClick={() => setTarget(pkg)}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors shrink-0"
                  aria-label="Hapus paket"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {target && (
        <ConfirmDialog
          title="Hapus paket ini?"
          description={`"${target.package_name}" akan dihapus permanen jika belum pernah dibayar dan belum dipakai untuk sesi apa pun. Jika sudah ada riwayat pembayaran atau sesi, paket akan dibatalkan saja agar riwayatnya tetap tersimpan.`}
          confirmLabel="Hapus"
          danger
          loading={deleting}
          onConfirm={handleConfirm}
          onCancel={() => setTarget(null)}
        />
      )}
    </div>
  )
}
