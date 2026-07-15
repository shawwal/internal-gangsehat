import { useState } from 'react'
import { Crown, Loader2, Trash2, Pencil, ArrowDownCircle, X } from 'lucide-react'
import { UserAvatar } from './UserAvatar'
import { formatDate, ROLE_LABELS, STAFF_ROLES } from './types'
import type { UserRow, BranchOption, UserRole } from './types'

interface Props {
  users: UserRow[]
  branches: BranchOption[]
  currentUserId: string | null
  savingId: string | null
  onUpdateField: (id: string, patch: Partial<Pick<UserRow, 'role' | 'branch_id' | 'is_active'>>) => void
  onDeleteTarget: (user: UserRow) => void
  onEditDetails: (user: UserRow) => void
}

interface DowngradeTarget { id: string; name: string }

export function DirectorCards({ users, branches, currentUserId, savingId, onUpdateField, onDeleteTarget, onEditDetails }: Props) {
  const [downgradeTarget, setDowngradeTarget] = useState<DowngradeTarget | null>(null)
  const [newRole, setNewRole]   = useState<UserRole>('staff')
  const [newBranch, setNewBranch] = useState('')

  function openDowngrade(u: UserRow) {
    setNewRole('staff')
    setNewBranch(branches[0]?.id ?? '')
    setDowngradeTarget({ id: u.id, name: u.full_name })
  }

  function confirmDowngrade() {
    if (!downgradeTarget || !newBranch) return
    onUpdateField(downgradeTarget.id, { role: newRole, branch_id: newBranch })
    setDowngradeTarget(null)
  }

  if (!users.length) {
    return <p className="text-sm text-muted-foreground col-span-3 text-center py-10">Belum ada direktur terdaftar.</p>
  }
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((u) => {
          const isSelf   = u.id === currentUserId
          const isSaving = savingId === u.id
          return (
            <div key={u.id} className="bg-card rounded-2xl border border-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar name={u.full_name} size="lg" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-foreground text-sm leading-tight truncate">
                        {u.full_name || '—'}
                      </p>
                      {u.gender === 'male' ? (
                        <span className="text-[11px] font-bold text-blue-500 leading-none" title="Pria">♂</span>
                      ) : u.gender === 'female' ? (
                        <span className="text-[11px] font-bold text-[#FF0090] leading-none" title="Wanita">♀</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/40 leading-none" title="Jenis kelamin belum diisi">⊘</span>
                      )}
                    </div>
                    {u.nickname && (
                      <p className="text-[11px] text-primary/80 font-medium truncate">"{u.nickname}"</p>
                    )}
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onEditDetails(u)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Edit detail"
                  >
                    <Pencil size={13} />
                  </button>
                  {!isSelf && (
                    <>
                      <button
                        onClick={() => openDowngrade(u)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-secondary-foreground hover:bg-secondary/20 transition-colors"
                        title="Turunkan peran"
                      >
                        <ArrowDownCircle size={13} />
                      </button>
                      <button
                        onClick={() => onDeleteTarget(u)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Nonaktifkan pengguna"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <Crown size={12} className="text-primary" />
                  <span className="text-xs font-medium text-primary">Direktur</span>
                  {isSelf && <span className="text-xs text-muted-foreground">(Anda)</span>}
                </div>
                <div className="flex items-center gap-2">
                  {isSaving && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
                  <button
                    disabled={isSaving || isSelf}
                    onClick={() => onUpdateField(u.id, { is_active: !u.is_active })}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors disabled:cursor-not-allowed ${
                      u.is_active
                        ? 'bg-chart-4/15 text-chart-4 hover:bg-chart-4/25'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    }`}
                  >
                    {u.is_active ? 'Aktif' : 'Nonaktif'}
                  </button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">Bergabung {formatDate(u.created_at)}</p>
            </div>
          )
        })}
      </div>

      {downgradeTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Turunkan Peran</h2>
              <button onClick={() => setDowngradeTarget(null)} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                <X size={16} />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              Ubah peran <span className="font-medium text-foreground">{downgradeTarget.name}</span> dari Direktur menjadi:
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Peran Baru</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Cabang</label>
                <select
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">Direktur tidak punya cabang — pilih cabang untuk peran baru.</p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setDowngradeTarget(null)}
                className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Batal
              </button>
              <button
                disabled={!newBranch}
                onClick={confirmDowngrade}
                className="flex-1 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                Turunkan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
