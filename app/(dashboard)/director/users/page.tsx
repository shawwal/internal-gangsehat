'use client'

import { useEffect, useState, useTransition } from 'react'
import { UserPlus, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { deleteInternalUser } from '@/app/actions/delete-user'
import { UserTabs }    from '@/components/users/UserTabs'
import { UserFilters } from '@/components/users/UserFilters'
import { StaffTable }  from '@/components/users/StaffTable'
import { DirectorCards } from '@/components/users/DirectorCards'
import { InviteModal } from '@/components/users/InviteModal'
import { DeleteModal } from '@/components/users/DeleteModal'
import { EditUserModal } from '@/components/users/EditUserModal'
import { STAFF_ROLES } from '@/components/users/types'
import type { UserRow, BranchOption, Tab, UserRole } from '@/components/users/types'

export default function UsersPage() {
  const [users, setUsers]       = useState<UserRow[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<Tab>('staff')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [search, setSearch]           = useState('')
  const [roleFilter, setRoleFilter]   = useState<UserRole | ''>('')
  const [branchFilter, setBranchFilter] = useState('')

  const [showInvite, setShowInvite]   = useState(false)
  const [inviteMsg, setInviteMsg]     = useState('')
  const [savingId, setSavingId]       = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [editTarget, setEditTarget]   = useState<UserRow | null>(null)
  const [isPending, startTransition]  = useTransition()

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)

    const [{ data: usersData }, { data: branchData }] = await Promise.all([
      supabase
        .from('internal_profiles')
        .select('id, full_name, email, phone, role, branch_id, is_active, created_at, nickname, gender, branches(name)')
        .order('full_name'),
      supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
    ])
    setUsers((usersData ?? []) as unknown as UserRow[])
    setBranches((branchData ?? []) as BranchOption[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function updateField(id: string, patch: Partial<Pick<UserRow, 'role' | 'branch_id' | 'is_active' | 'full_name' | 'phone' | 'nickname' | 'gender'>>) {
    setSavingId(id)
    await createClient().from('internal_profiles').update(patch).eq('id', id)
    setSavingId(null)
    load()
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

  function handleTabChange(next: Tab) {
    setTab(next)
    setRoleFilter('')
    setBranchFilter('')
    setSearch('')
  }

  const staffList    = users.filter((u) => STAFF_ROLES.includes(u.role))
  const directorList = users.filter((u) => u.role === 'director')
  const tabList      = tab === 'staff' ? staffList : directorList

  const filtered = tabList.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false
    if (branchFilter === '__none__' && u.branch_id !== null) return false
    if (branchFilter && branchFilter !== '__none__' && u.branch_id !== branchFilter) return false
    const q = search.toLowerCase()
    return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

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

      <UserTabs
        tab={tab}
        staffCount={staffList.length}
        directorCount={directorList.length}
        onChange={handleTabChange}
      />

      {!loading && (
        <UserFilters
          tab={tab}
          search={search}
          roleFilter={roleFilter}
          branchFilter={branchFilter}
          branches={branches}
          activeCount={filtered.filter((u) => u.is_active).length}
          totalCount={filtered.length}
          onSearch={setSearch}
          onRoleFilter={setRoleFilter}
          onBranchFilter={setBranchFilter}
        />
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 size={15} className="animate-spin" /> Memuat...
        </div>
      ) : tab === 'director' ? (
        <DirectorCards
          users={filtered}
          currentUserId={currentUserId}
          savingId={savingId}
          onUpdateField={updateField}
          onDeleteTarget={setDeleteTarget}
          onEditDetails={setEditTarget}
        />
      ) : (
        <StaffTable
          users={filtered}
          branches={branches}
          currentUserId={currentUserId}
          savingId={savingId}
          search={search}
          onUpdateField={updateField}
          onDeleteTarget={setDeleteTarget}
          onEditDetails={setEditTarget}
        />
      )}

      {showInvite && (
        <InviteModal
          branches={branches}
          onClose={() => setShowInvite(false)}
          onSuccess={() => {
            setInviteMsg('Undangan terkirim!')
            setTimeout(() => setInviteMsg(''), 5000)
            setTimeout(load, 2000)
          }}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          target={deleteTarget}
          isPending={isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {editTarget && (
        <EditUserModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={async (id, patch) => {
            await updateField(id, patch)
          }}
        />
      )}
    </div>
  )
}
