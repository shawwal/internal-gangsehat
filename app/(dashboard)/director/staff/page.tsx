'use client'

import { useEffect, useState } from 'react'
import { Search, UserCog } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'

interface StaffRow {
  id: string
  full_name: string
  email: string
  role: UserRole
  is_active: boolean
  branch_id: string | null
  branches: { name: string } | null
}

const ROLE_LABELS: Record<UserRole, string> = {
  director: 'Direktur', finance: 'Keuangan', hr: 'HR', marketing: 'Marketing',
}

const ALL_ROLES: UserRole[] = ['director', 'finance', 'hr', 'marketing']

export default function DirectorStaffPage() {
  const [staff, setStaff]       = useState<StaffRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [editId, setEditId]     = useState<string | null>(null)
  const [editRole, setEditRole] = useState<UserRole>('marketing')
  const [saving, setSaving]     = useState(false)

  async function load() {
    const { data } = await createClient()
      .from('internal_profiles')
      .select('id, full_name, email, role, is_active, branch_id, branches(name)')
      .order('full_name')
    setStaff((data ?? []) as unknown as StaffRow[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = staff.filter((s) =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  )

  async function saveRole(id: string, role: UserRole) {
    setSaving(true)
    await createClient().from('internal_profiles').update({ role }).eq('id', id)
    setSaving(false)
    setEditId(null)
    load()
  }

  async function toggleActive(s: StaffRow) {
    await createClient().from('internal_profiles').update({ is_active: !s.is_active }).eq('id', s.id)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Staff</h1>
          <p className="text-sm text-muted-foreground">Kelola semua staff lintas cabang</p>
        </div>
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau email..."
            className="w-full pl-8 pr-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nama</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cabang</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.branches?.name ?? 'Semua Cabang'}</td>
                  <td className="px-4 py-3">
                    {editId === s.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as UserRole)}
                          className="text-xs border border-border rounded-lg px-2 py-1 bg-input focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                        <button
                          onClick={() => saveRole(s.id, editRole)}
                          disabled={saving}
                          className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-lg hover:bg-primary/90 disabled:opacity-60"
                        >
                          Simpan
                        </button>
                        <button onClick={() => setEditId(null)} className="text-xs text-muted-foreground hover:text-foreground">
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{ROLE_LABELS[s.role]}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.is_active ? 'bg-chart-4/15 text-chart-4' : 'bg-muted text-muted-foreground'}`}>
                      {s.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditId(s.id); setEditRole(s.role) }}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                        title="Ubah role"
                      >
                        <UserCog size={14} />
                      </button>
                      <button
                        onClick={() => toggleActive(s)}
                        className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
                      >
                        {s.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <p className="text-sm text-muted-foreground text-center py-8">Tidak ada staff ditemukan.</p>
          )}
        </div>
      )}
    </div>
  )
}
