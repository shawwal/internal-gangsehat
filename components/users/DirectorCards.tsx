import { Crown, Loader2, Trash2, Pencil } from 'lucide-react'
import { UserAvatar } from './UserAvatar'
import { formatDate } from './types'
import type { UserRow } from './types'

interface Props {
  users: UserRow[]
  currentUserId: string | null
  savingId: string | null
  onUpdateField: (id: string, patch: Partial<Pick<UserRow, 'is_active'>>) => void
  onDeleteTarget: (user: UserRow) => void
  onEditDetails: (user: UserRow) => void
}

export function DirectorCards({ users, currentUserId, savingId, onUpdateField, onDeleteTarget, onEditDetails }: Props) {
  if (!users.length) {
    return <p className="text-sm text-muted-foreground col-span-3 text-center py-10">Belum ada direktur terdaftar.</p>
  }
  return (
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
                  <p className="font-semibold text-foreground text-sm leading-tight truncate">
                    {u.full_name || '—'}
                  </p>
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
                  <button
                    onClick={() => onDeleteTarget(u)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Hapus pengguna"
                  >
                    <Trash2 size={13} />
                  </button>
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
  )
}
