'use client'

import { useEffect, useState, useTransition } from 'react'
import { Search, Trash2, UserPlus, Loader2, TriangleAlert, X, Users, Crown, ChevronDown, Building2 } from 'lucide-react'
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
  director:  'Direktur',
  finance:   'Keuangan',
  hr:        'HR',
  marketing: 'Marketing',
  staff:     'Staff',
  therapist: 'Terapis',
  manager:   'Manager',
}
const ROLE_COLOR: Record<UserRole, string> = {
  director:  'bg-primary/10 text-primary',
  finance:   'bg-blue-500/15 text-blue-500',
  hr:        'bg-violet-500/15 text-violet-500',
  marketing: 'bg-secondary/20 text-secondary-foreground',
  staff:     'bg-muted text-muted-foreground',
  therapist: 'bg-green-500/15 text-green-600',
  manager:   'bg-orange-500/15 text-orange-600',
}

const STAFF_ROLES: UserRole[] = ['finance', 'hr', 'marketing', 'staff', 'therapist', 'manager']

type Tab = 'staff' | 'director'

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || '?'
  const cls = size === 'lg'
    ? 'w-12 h-12 text-sm'
    : size === 'sm'
    ? 'w-7 h-7 text-xs'
    : 'w-9 h-9 text-xs'
  return (
    <div className={`${cls} rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0`}>
      {initials}
    </div>
  )
}

export default function UsersPage() {
  const [users, setUsers]       = useState<UserRow[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [tab, setTab]           = useState<Tab>('staff')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [showInvite, setShowInvite]     = useState(false)
  const [inviteEmail, setInviteEmail]   = useState('')
  const [inviteName, setInviteName]     = useState('')
  const [inviteRole, setInviteRole]     = useState<UserRole>('marketing')
  const [inviteBranch, setInviteBranch] = useState('')
  const [inviting, setInviting]         = useState(false)
  const [inviteMsg, setInviteMsg]       = useState('')

  const [savingId, setSavingId] = useState<string | null>(null)

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
      supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
    ])
    setUsers((usersData ?? []) as unknown as UserRow[])
    setBranches((branchData ?? []) as BranchOption[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const staffList    = users.filter((u) => STAFF_ROLES.includes(u.role))
  const directorList = users.filter((u) => u.role === 'director')

  const tabList = tab === 'staff' ? staffList : directorList

  const filtered = tabList.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false
    const q = search.toLowerCase()
    return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  async function updateField(id: string, patch: Partial<Pick<UserRow, 'role' | 'branch_id' | 'is_active'>>) {
    setSavingId(id)
    await createClient().from('internal_profiles').update(patch).eq('id', id)
    setSavingId(null)
    load()
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    const { error } = await createClient().auth.signInWithOtp({
      email: inviteEmail,
      options: { data: { full_name: inviteName } },
    })
    if (error) {
      setInviteMsg('Gagal: ' + error.message)
    } else {
      setInviteMsg(`Undangan terkirim ke ${inviteEmail}`)
      setShowInvite(false)
      setInviteEmail(''); setInviteName(''); setInviteRole('marketing'); setInviteBranch('')
      setTimeout(load, 2000)
    }
    setInviting(false)
    setTimeout(() => setInviteMsg(''), 5000)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    startTransition(async () => {
      const result = await deleteInternalUser(id)
      if (result.error) alert(result.error)
      else load()
    })
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Staff &amp; Pengguna</h1>
          <p className="text-sm text-muted-foreground">{users.length} akun terdaftar</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <UserPlus size={15} /> Undang
        </button>
      </div>

      {inviteMsg && (
        <p className={`text-sm px-4 py-2 rounded-xl ${inviteMsg.includes('terkirim') ? 'bg-chart-4/10 text-chart-4' : 'bg-destructive/10 text-destructive'}`}>
          {inviteMsg}
        </p>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/70 rounded-2xl w-fit border border-border">
        <button
          onClick={() => { setTab('staff'); setRoleFilter('') }}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'staff'
              ? 'bg-card text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users size={14} />
          Staff
          <span className={`min-w-[20px] text-center text-xs px-1.5 py-0.5 rounded-full font-semibold transition-colors ${
            tab === 'staff' ? 'bg-primary text-primary-foreground' : 'bg-border text-muted-foreground'
          }`}>
            {staffList.length}
          </span>
        </button>
        <button
          onClick={() => { setTab('director'); setRoleFilter('') }}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'director'
              ? 'bg-card text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Crown size={14} />
          Direktur
          <span className={`min-w-[20px] text-center text-xs px-1.5 py-0.5 rounded-full font-semibold transition-colors ${
            tab === 'director' ? 'bg-primary text-primary-foreground' : 'bg-border text-muted-foreground'
          }`}>
            {directorList.length}
          </span>
        </button>
      </div>

      {/* Search + filter + stats row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-64">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau email..."
            className="w-full pl-8 pr-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {tab === 'staff' && (
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
              className="appearance-none pl-3 pr-7 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
            >
              <option value="">Semua Role</option>
              {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
        )}
        {!loading && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full border border-border">
              {filtered.filter((u) => u.is_active).length} aktif dari {filtered.length}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 size={15} className="animate-spin" /> Memuat...
        </div>
      ) : tab === 'director' ? (
        /* ── Director cards ── */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((u) => {
            const isSelf   = u.id === currentUserId
            const isSaving = savingId === u.id
            return (
              <div key={u.id} className="bg-card rounded-2xl border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={u.full_name} size="lg" />
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm leading-tight truncate">
                        {u.full_name || '—'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>
                  {!isSelf && (
                    <button
                      onClick={() => setDeleteTarget(u)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
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
                      onClick={() => updateField(u.id, { is_active: !u.is_active })}
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
          {!filtered.length && (
            <p className="text-sm text-muted-foreground col-span-3 text-center py-10">Belum ada direktur terdaftar.</p>
          )}
        </div>
      ) : (
        /* ── Staff table ── */
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nama</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cabang</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Bergabung</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isSelf   = u.id === currentUserId
                  const isSaving = savingId === u.id
                  return (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={u.full_name} size="sm" />
                          <div className="min-w-0">
                            <p className="font-medium text-foreground leading-tight truncate">
                              {u.full_name || '—'}
                              {isSelf && <span className="ml-1 text-xs text-muted-foreground font-normal">(Anda)</span>}
                            </p>
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
                            onChange={(e) => updateField(u.id, { role: e.target.value as UserRole })}
                            className="text-xs border border-border rounded-lg px-2 py-1 bg-input focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                        )}
                      </td>

                      {/* Branch */}
                      <td className="px-4 py-3">
                        {isSelf ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 size={11} />
                            {u.branches?.name ?? '—'}
                          </span>
                        ) : (
                          <select
                            value={u.branch_id ?? ''}
                            disabled={isSaving}
                            onChange={(e) => updateField(u.id, { branch_id: e.target.value || null })}
                            className="text-xs border border-border rounded-lg px-2 py-1 bg-input focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed max-w-[160px]"
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
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap hidden md:table-cell">
                        {formatDate(u.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        {isSaving ? (
                          <Loader2 size={13} className="animate-spin text-muted-foreground ml-auto" />
                        ) : !isSelf ? (
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 size={13} />
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
                {search ? `Tidak ada yang cocok dengan "${search}"` : 'Belum ada staff terdaftar.'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-5">
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
              <div className="grid grid-cols-2 gap-3">
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
                <button type="button" onClick={() => setShowInvite(false)}
                  className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={inviting}
                  className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                  {inviting && <Loader2 size={13} className="animate-spin" />}
                  {inviting ? 'Mengirim...' : 'Kirim Undangan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <TriangleAlert size={18} className="text-destructive" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Hapus Pengguna</h2>
                <p className="text-xs text-muted-foreground">{deleteTarget.email}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              Akun <span className="font-semibold text-foreground">{deleteTarget.full_name || deleteTarget.email}</span> akan dihapus permanen.
            </p>
            <p className="text-sm font-medium text-destructive mb-5">Tindakan ini tidak dapat dibatalkan.</p>
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
