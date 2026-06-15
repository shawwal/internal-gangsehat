import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { UserRow } from './types'

interface Props {
  user: UserRow
  onClose: () => void
  onSave: (id: string, patch: Partial<Pick<UserRow, 'full_name' | 'phone' | 'nickname' | 'gender'>>) => Promise<void>
}

export function EditUserModal({ user, onClose, onSave }: Props) {
  const [fullName, setFullName] = useState(user.full_name)
  const [nickname, setNickname] = useState(user.nickname ?? '')
  const [phone, setPhone]       = useState(user.phone ?? '')
  const [gender, setGender]     = useState<'male' | 'female' | null>(user.gender ?? null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await onSave(user.id, {
      full_name: fullName.trim() || user.full_name,
      nickname:  nickname.trim() || null,
      phone:     phone.trim() || null,
      gender,
    })
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">Edit Detail Pengguna</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Nama Lengkap</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nama lengkap"
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Nama Panggilan <span className="text-muted-foreground font-normal">(opsional)</span>
            </label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Contoh: Andi, Budi, Sari"
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Ditampilkan di jadwal harian jika diisi.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Jenis Kelamin <span className="text-muted-foreground font-normal">(opsional)</span>
            </label>
            <div className="flex items-center gap-2">
              {([
                { value: 'male',   label: 'Pria',   color: 'bg-blue-500 text-white shadow-blue-500/25' },
                { value: 'female', label: 'Wanita', color: 'bg-[#FF0090] text-white shadow-primary/25' },
              ] as const).map(({ value, label, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGender(gender === value ? null : value)}
                  aria-pressed={gender === value}
                  className={[
                    'flex-1 py-2 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer border',
                    gender === value
                      ? `${color} border-transparent shadow-sm`
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Nomor Telepon <span className="text-muted-foreground font-normal">(opsional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
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
