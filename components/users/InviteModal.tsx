import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ROLE_LABELS } from './types'
import type { BranchOption, UserRole } from './types'

interface Props {
  branches: BranchOption[]
  onClose: () => void
  onSuccess: () => void
}

export function InviteModal({ branches, onClose, onSuccess }: Props) {
  const [email, setEmail]   = useState('')
  const [name, setName]     = useState('')
  const [role, setRole]     = useState<UserRole>('marketing')
  const [branch, setBranch] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { data: { full_name: name } },
    })
    if (error) {
      setMsg('Gagal: ' + error.message)
    } else {
      onClose()
      onSuccess()
    }
    setLoading(false)
    if (error) setTimeout(() => setMsg(''), 5000)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">Undang Pengguna</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        {msg && (
          <p className="text-sm px-3 py-2 mb-3 rounded-xl bg-destructive/10 text-destructive">{msg}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Nama Lengkap</label>
            <input
              required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Nama lengkap pengguna"
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Email</label>
            <input
              required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="email@contoh.com"
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Role</label>
              <select
                value={role} onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Cabang</label>
              <select
                value={branch} onChange={(e) => setBranch(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">— (Direktur)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
            Pengguna akan menerima magic link untuk login. Role dan cabang dapat diubah setelah bergabung.
          </p>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
              Batal
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 size={13} className="animate-spin" />}
              {loading ? 'Mengirim...' : 'Kirim Undangan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
