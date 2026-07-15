import { Loader2, Trash2, Building2, Pencil } from 'lucide-react'
import { UserAvatar } from './UserAvatar'
import { ROLE_LABELS, ROLE_COLOR, formatDate } from './types'
import type { UserRow, BranchOption, UserRole } from './types'

interface Props {
  users: UserRow[]
  branches: BranchOption[]
  currentUserId: string | null
  savingId: string | null
  search: string
  onUpdateField: (id: string, patch: Partial<Pick<UserRow, 'role' | 'branch_id' | 'is_active'>>) => void
  onDeleteTarget: (user: UserRow) => void
  onEditDetails: (user: UserRow) => void
}

export function StaffTable({ users, branches, currentUserId, savingId, search, onUpdateField, onDeleteTarget, onEditDetails }: Props) {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nama</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[200px]">Cabang</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Bergabung</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf   = u.id === currentUserId
              const isSaving = savingId === u.id
              return (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  {/* Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar name={u.full_name} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium text-foreground leading-tight truncate">
                            {u.full_name || '—'}
                            {isSelf && <span className="ml-1 text-xs text-muted-foreground font-normal">(Anda)</span>}
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
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[u.role]}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        disabled={isSaving}
                        onChange={(e) => onUpdateField(u.id, { role: e.target.value as UserRole })}
                        className="text-xs border border-border rounded-lg px-2 py-1 bg-input focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    )}
                  </td>

                  {/* Branch */}
                  <td className="px-4 py-3 min-w-[200px]">
                    {isSelf ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 size={11} />
                        {u.branches?.name ?? '—'}
                      </span>
                    ) : (
                      <select
                        value={u.branch_id ?? ''}
                        disabled={isSaving}
                        onChange={(e) => onUpdateField(u.id, { branch_id: e.target.value || null })}
                        className="text-xs border border-border rounded-lg px-2 py-1 bg-input focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed w-full max-w-[220px]"
                      >
                        <option value="">— Belum ditentukan</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    <button
                      disabled={isSaving || isSelf}
                      onClick={() => onUpdateField(u.id, { is_active: !u.is_active })}
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-colors disabled:cursor-not-allowed ${
                        u.is_active
                          ? 'bg-chart-4/15 text-chart-4 hover:bg-chart-4/25'
                          : 'bg-muted text-muted-foreground hover:bg-muted/70'
                      }`}
                    >
                      {u.is_active ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </td>

                  {/* Joined */}
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap hidden md:table-cell">
                    {formatDate(u.created_at)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    {isSaving ? (
                      <Loader2 size={13} className="animate-spin text-muted-foreground ml-auto" />
                    ) : (
                      <div className="flex items-center justify-end gap-1">
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
                            title="Nonaktifkan pengguna"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!users.length && (
          <p className="text-sm text-muted-foreground text-center py-10">
            {search ? `Tidak ada yang cocok dengan "${search}"` : 'Belum ada staff terdaftar.'}
          </p>
        )}
      </div>
    </div>
  )
}
