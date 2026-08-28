import { useState } from 'react'
import { X, Loader2, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react'
import { changeUserPassword } from '@/app/actions/change-user-password'
import type { UserRow } from './types'

interface Props {
  user: UserRow
  onClose: () => void
}

export function ChangePasswordModal({ user, onClose }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const mismatch = confirm.length > 0 && password !== confirm

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mismatch || password.length < 8) return
    setLoading(true)
    setResult(null)
    const res = await changeUserPassword(user.id, password)
    setLoading(false)
    if (res.error) {
      setResult({ ok: false, message: res.error })
    } else {
      setResult({ ok: true, message: 'Kata sandi berhasil diperbarui.' })
      setPassword('')
      setConfirm('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <KeyRound size={15} className="text-primary" /> Ubah Kata Sandi
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Untuk <span className="font-medium text-foreground">{user.full_name || user.email}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Kata Sandi Baru</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Konfirmasi Kata Sandi</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Ulangi kata sandi baru"
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {mismatch && <p className="text-[11px] text-destructive mt-1">Kata sandi tidak cocok.</p>}
          </div>

          {result && (
            <div className={`flex items-start gap-2 text-xs rounded-xl px-3 py-2 ${result.ok ? 'bg-chart-4/10 text-chart-4' : 'bg-destructive/10 text-destructive'}`}>
              {result.ok ? <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} className="mt-0.5 shrink-0" />}
              <span>{result.message}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={loading || mismatch || password.length < 8 || !confirm}
              className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
