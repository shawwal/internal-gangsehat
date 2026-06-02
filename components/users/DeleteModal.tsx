import { Loader2, TriangleAlert } from 'lucide-react'
import type { UserRow } from './types'

interface Props {
  target: UserRow
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteModal({ target, isPending, onCancel, onConfirm }: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <TriangleAlert size={18} className="text-destructive" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Hapus Pengguna</h2>
            <p className="text-xs text-muted-foreground">{target.email}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-1">
          Akun <span className="font-semibold text-foreground">{target.full_name || target.email}</span> akan dihapus permanen.
        </p>
        <p className="text-sm font-medium text-destructive mb-5">Tindakan ini tidak dapat dibatalkan.</p>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
            Batal
          </button>
          <button onClick={onConfirm} disabled={isPending}
            className="flex-1 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            {isPending && <Loader2 size={14} className="animate-spin" />}
            {isPending ? 'Menghapus...' : 'Ya, Hapus'}
          </button>
        </div>
      </div>
    </div>
  )
}
