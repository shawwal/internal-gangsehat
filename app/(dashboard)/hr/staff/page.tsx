'use client'

import { useEffect, useState } from 'react'
import { Search, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'

interface StaffRow {
  id: string
  full_name: string
  email: string
  role: UserRole
  is_active: boolean
}

const ROLE_LABELS: Record<UserRole, string> = {
  director: 'Direktur', finance: 'Keuangan', hr: 'HR', marketing: 'Marketing',
}

export default function HRStaffPage() {
  const [staff, setStaff]       = useState<StaffRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState<UserRole>('marketing')
  const [saving, setSaving]     = useState(false)
  const [message, setMessage]   = useState('')

  async function load() {
    const { data } = await createClient()
      .from('internal_profiles')
      .select('id, full_name, email, role, is_active')
      .order('full_name')
    setStaff((data ?? []) as StaffRow[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = staff.filter((s) =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  )

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { error } = await (supabase.auth as any).admin?.inviteUserByEmail
      ? (supabase.auth as any).admin.inviteUserByEmail(inviteEmail)
      : supabase.auth.signInWithOtp({ email: inviteEmail })

    if (!error) {
      setMessage(`Undangan terkirim ke ${inviteEmail}`)
      setInviteEmail('')
      setShowInvite(false)
    } else {
      setMessage('Gagal mengirim undangan.')
    }
    setSaving(false)
    setTimeout(() => setMessage(''), 4000)
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
          <p className="text-sm text-muted-foreground">Kelola staff di cabang Anda</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari..."
              className="w-full pl-8 pr-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <button onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <UserPlus size={16} /> Undang
          </button>
        </div>
      </div>

      {message && (
        <p className="text-sm text-chart-4 bg-chart-4/10 rounded-xl px-4 py-2">{message}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nama</th>
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
                  <td className="px-4 py-3">
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{ROLE_LABELS[s.role]}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.is_active ? 'bg-chart-4/15 text-chart-4' : 'bg-muted text-muted-foreground'}`}>
                      {s.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggleActive(s)} className="text-xs text-muted-foreground underline hover:text-foreground transition-colors">
                      {s.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <p className="text-sm text-muted-foreground text-center py-8">Tidak ada staff.</p>}
        </div>
      )}

      {showInvite && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold text-foreground mb-4">Undang Staff</h2>
            <form onSubmit={handleInvite} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Email</label>
                <input required type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Role</label>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary">
                  {(['finance','hr','marketing'] as UserRole[]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowInvite(false)} className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Batal</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {saving ? 'Mengirim...' : 'Kirim Undangan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
