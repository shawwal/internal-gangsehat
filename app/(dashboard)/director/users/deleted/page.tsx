'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { permanentlyDeleteUser } from '@/app/actions/delete-user'
import { UserAvatar } from '@/components/users/UserAvatar'
import { PurgeModal } from '@/components/users/PurgeModal'
import { ROLE_LABELS, ROLE_COLOR, formatDate } from '@/components/users/types'
import type { UserRow } from '@/components/users/types'

export default function DeletedUsersPage() {
  const [users, setUsers]     = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [purgeTarget, setPurgeTarget] = useState<UserRow | null>(null)
  const [isPending, startTransition]  = useTransition()

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('internal_profiles')
      .select('id, full_name, email, phone, role, branch_id, is_active, created_at, nickname, gender, branches(name)')
      .eq('is_active', false)
      .order('full_name')
    setUsers((data ?? []) as unknown as UserRow[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function confirmPurge() {
    if (!purgeTarget) return
    const id = purgeTarget.id
    startTransition(async () => {
      const result = await permanentlyDeleteUser(id)
      setPurgeTarget(null)
      if (result.error) alert(result.error)
      else load()
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/director/users" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
          <ArrowLeft size={14} /> Kembali ke Staff &amp; Pengguna
        </Link>
        <h1 className="text-xl font-semibold text-foreground">Pengguna Nonaktif</h1>
        <p className="text-sm text-muted-foreground">
          {users.length} akun nonaktif — hapus permanen untuk menghapus akun beserta seluruh data miliknya (kehadiran, cuti, target, jadwal, gaji, notifikasi) secara permanen.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 size={15} className="animate-spin" /> Memuat...
        </div>
      ) : !users.length ? (
        <p className="text-sm text-muted-foreground text-center py-10">Tidak ada pengguna nonaktif.</p>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nama</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[160px]">Cabang</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Bergabung</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={u.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground leading-tight truncate">{u.full_name || '—'}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[u.role]}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{u.branches?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap hidden md:table-cell">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setPurgeTarget(u)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Hapus permanen"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {purgeTarget && (
        <PurgeModal
          target={purgeTarget}
          isPending={isPending}
          onCancel={() => setPurgeTarget(null)}
          onConfirm={confirmPurge}
        />
      )}
    </div>
  )
}
