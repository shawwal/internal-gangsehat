'use client'

import { useState } from 'react'
import { Loader2, TriangleAlert } from 'lucide-react'
import type { UserRow } from './types'

interface Props {
  target: UserRow
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function PurgeModal({ target, isPending, onCancel, onConfirm }: Props) {
  const [confirmText, setConfirmText] = useState('')
  const expected = target.full_name || target.email
  const matched = confirmText.trim() === expected

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <TriangleAlert size={18} className="text-destructive" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Hapus Permanen</h2>
            <p className="text-xs text-muted-foreground">{target.email}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-1">
          Akun <span className="font-semibold text-foreground">{expected}</span> beserta seluruh data miliknya
          (kehadiran, cuti, target, jadwal, gaji, notifikasi) akan dihapus permanen dari database.
        </p>
        <p className="text-sm font-medium text-destructive mb-4">Tindakan ini tidak dapat dibatalkan.</p>

        <label className="block text-xs font-medium text-foreground mb-1.5">
          Ketik <span className="font-mono font-semibold">{expected}</span> untuk konfirmasi
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          disabled={isPending}
          className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-destructive mb-5 disabled:opacity-60"
          autoFocus
        />

        <div className="flex gap-2">
          <button onClick={onCancel} disabled={isPending}
            className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            Batal
          </button>
          <button onClick={onConfirm} disabled={isPending || !matched}
            className="flex-1 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
            {isPending && <Loader2 size={14} className="animate-spin" />}
            {isPending ? 'Menghapus...' : 'Hapus Permanen'}
          </button>
        </div>
      </div>
    </div>
  )
}
