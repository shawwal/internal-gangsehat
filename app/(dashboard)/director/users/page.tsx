'use client'

import { useEffect, useState, useTransition } from 'react'
import { Search, Trash2, UserPlus, Loader2, TriangleAlert, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { deleteInternalUser } from '@/app/actions/delete-user'
import type { UserRole } from '@/types'

interface UserRow {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: UserRole
  branch_id: string | null
  is_active: boolean
  created_at: string
  branches: { name: string } | null
}

interface BranchOption { id: string; name: string }

const ROLE_LABELS: Record<UserRole, string> = {
  director: 'Direktur', finance: 'Keuangan', hr: 'HR', marketing: 'Marketing',
}
const ROLE_COLOR: Record<UserRole, string> = {
  director:  'bg-primary/10 text-primary',
  finance:   'bg-chart-3/15 text-chart-3',
  hr:        'bg-chart-5/15 text-chart-5',
  marketing: 'bg-secondary/20 text-secondary-foreground',
}

export default function UsersPage() {
  const [users, setUsers]         = useState<UserRow[]>([])
  const [branches, setBranches]   = useState<BranchOption[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // invite
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName]   = useState('')
  const [inviteRole, setInviteRole]   = useState<UserRole>('marketing')
  const [inviteBranch, setInviteBranch] = useState('')
  const [inviting, setInviting]     = useState(false)
  const [inviteMsg, setInviteMsg]   = useState('')

  // inline edits
  const [savingId, setSavingId]   = useState<string | null>(null)

  // delete
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [isPending, startTransition]    = useTransition()

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)

    const [{ data: usersData }, { data: branchData }] = await Promise.all([
      supabase
        .from('internal_profiles')
        .select('id, full_name, email, phone, role, branch_id, is_active, created_at, branches(name)')
        .order('full_name'),
      supabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
    ])
    setUsers((usersData ?? []) as unknown as UserRow[])
    setBranches((branchData ?? []) as BranchOption[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = users.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  async function updateField(id: string, patch: Partial<Pick<UserRow, 'role' | 'branch_id' | 'is_active'>>) {
    setSavingId(id)
    await createClient().from('internal_profiles').update(patch).eq('id', id)
    setSavingId(null)
    load()
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOtp({
      email: inviteEmail,
      options: { data: { full_name: inviteName } },
    })

    if (error) {
      setInviteMsg('Gagal mengirim undangan: ' + error.message)
    } else {
      setInviteMsg(`Undangan terkirim ke ${inviteEmail}`)
      setShowInvite(false)
      setInviteEmail('')
      setInviteName('')
      setInviteRole('marketing')
      setInviteBranch('')
      setTimeout(() => load(), 2000)
    }
    setInviting(false)
    setTimeout(() => setInviteMsg(''), 5000)
  }

  function handleDelete(user: UserRow) {
    setDeleteTarget(user)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    startTransition(async () => {
      const result = await deleteInternalUser(id)
      if (result.error) {
        alert(result.error)
      } else {
        load()
      }
    })
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Manajemen Pengguna</h1>
          <p className="text-sm text-muted-foreground">{users.length} pengguna terdaftar</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-60">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau email..."
              className="w-full pl-8 pr-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <UserPlus size={16} /> Undang
          </button>
        </div>
      </div>

      {inviteMsg && (
        <p className={`text-sm px-4 py-2 rounded-xl ${inviteMsg.includes('terkirim') ? 'bg-chart-4/10 text-chart-4' : 'bg-destructive/10 text-destructive'}`}>
          {inviteMsg}
        </p>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pengguna</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cabang</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bergabung</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isSelf = u.id === currentUserId
                  const isSaving = savingId === u.id
                  return (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                            {u.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-foreground leading-tight">
                              {u.full_name || '—'}
                              {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(Anda)</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          disabled={isSaving || isSelf}
                          onChange={(e) => updateField(u.id, { role: e.target.value as UserRole })}
                          className="text-xs border border-border rounded-lg px-2 py-1 bg-input focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                        {!isSelf && (
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[u.role]}`}>
                            {ROLE_LABELS[u.role]}
                          </span>
                        )}
                      </td>

                      {/* Branch */}
                      <td className="px-4 py-3">
                        <select
                          value={u.branch_id ?? ''}
                          disabled={isSaving || isSelf}
                          onChange={(e) => updateField(u.id, { branch_id: e.target.value || null })}
                          className="text-xs border border-border rounded-lg px-2 py-1 bg-input focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed max-w-[180px]"
                        >
                          <option value="">Semua Cabang</option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <button
                          disabled={isSaving || isSelf}
                          onClick={() => updateField(u.id, { is_active: !u.is_active })}
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
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(u.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        {isSaving ? (
                          <Loader2 size={14} className="animate-spin text-muted-foreground ml-auto" />
                        ) : !isSelf ? (
                          <button
                            onClick={() => handleDelete(u)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Hapus pengguna"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!filtered.length && (
              <p className="text-sm text-muted-foreground text-center py-10">
                {search ? `Tidak ada pengguna yang cocok dengan "${search}"` : 'Belum ada pengguna.'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Undang Pengguna</h2>
              <button onClick={() => setShowInvite(false)} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleInvite} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Nama Lengkap</label>
                <input
                  required value={inviteName} onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Nama lengkap pengguna"
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Email</label>
                <input
                  required type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@contoh.com"
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Role</label>
                <select
                  value={inviteRole} onChange={(e) => setInviteRole(e.target.value as UserRole)}
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
                  value={inviteBranch} onChange={(e) => setInviteBranch(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Semua Cabang (Director)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                Pengguna akan menerima magic link untuk login. Role dan cabang dapat diubah setelah mereka bergabung.
              </p>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowInvite(false)}
                  className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={inviting}
                  className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {inviting ? 'Mengirim...' : 'Kirim Undangan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <TriangleAlert size={18} className="text-destructive" />
              </div>
              <h2 className="text-base font-semibold text-foreground">Hapus Pengguna</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              Anda akan menghapus akun{' '}
              <span className="font-semibold text-foreground">{deleteTarget.full_name || deleteTarget.email}</span>.
            </p>
            <p className="text-sm font-medium text-destructive mb-5">
              Tindakan ini tidak dapat dibatalkan dan semua data terkait akan hilang.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                Batal
              </button>
              <button onClick={confirmDelete} disabled={isPending}
                className="flex-1 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {isPending && <Loader2 size={14} className="animate-spin" />}
                {isPending ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
