'use client'

import { Trash2 } from 'lucide-react'

interface Props {
  open: boolean
  deleting: boolean
  onConfirm: () => void
  onClose: () => void
}

export function DeleteDialog({ open, deleting, onConfirm, onClose }: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-2xl bg-[#FF3B30]/10 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={20} className="text-[#FF3B30]" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">Hapus Jadwal?</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Jadwal ini akan dihapus secara permanen dan tidak dapat dipulihkan.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-border text-sm hover:bg-muted transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2 rounded-xl bg-[#FF3B30] text-white text-sm font-medium hover:bg-[#FF3B30]/90 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {deleting ? 'Menghapus...' : 'Hapus'}
          </button>
        </div>
      </div>
    </div>
  )
}
