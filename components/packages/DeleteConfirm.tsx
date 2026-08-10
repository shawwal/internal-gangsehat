import { Trash2 } from 'lucide-react'
import type { ComponentType } from 'react'

interface DeleteConfirmProps {
  onConfirm: () => void
  onCancel:  () => void
  icon?:       ComponentType<{ size?: number; className?: string }>
  title?:      string
  description?: string
  confirmLabel?: string
}

export function DeleteConfirm({
  onConfirm,
  onCancel,
  icon: Icon = Trash2,
  title = 'Batalkan Paket?',
  description = 'Paket akan ditandai sebagai dibatalkan. Riwayat sesi tetap tersimpan.',
  confirmLabel = 'Ya, Batalkan',
}: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-sm shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-destructive/10 flex items-center justify-center shrink-0">
            <Icon size={18} className="text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {description}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Kembali
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
