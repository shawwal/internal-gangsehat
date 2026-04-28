'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const [form, setForm]         = useState({ full_name: '', phone: '' })
  const [pwForm, setPwForm]     = useState({ current: '', next: '', confirm: '' })
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [msg, setMsg]           = useState('')
  const [pwMsg, setPwMsg]       = useState('')

  useEffect(() => {
    createClient()
      .from('internal_profiles')
      .select('full_name, phone')
      .single()
      .then(({ data }) => {
        if (data) setForm({ full_name: data.full_name ?? '', phone: data.phone ?? '' })
        setLoading(false)
      })
  }, [])

  function flash(set: (v: string) => void, msg: string) {
    set(msg)
    setTimeout(() => set(''), 4000)
  }

  async function handleProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from('internal_profiles')
      .update({ full_name: form.full_name, phone: form.phone || null })
      .eq('id', user.id)
    setSaving(false)
    flash(setMsg, error ? 'Gagal menyimpan.' : 'Profil berhasil diperbarui.')
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwForm.next !== pwForm.confirm) {
      flash(setPwMsg, 'Konfirmasi kata sandi tidak cocok.')
      return
    }
    if (pwForm.next.length < 6) {
      flash(setPwMsg, 'Kata sandi minimal 6 karakter.')
      return
    }
    setSavingPw(true)
    const { error } = await createClient().auth.updateUser({ password: pwForm.next })
    setSavingPw(false)
    if (error) {
      flash(setPwMsg, 'Gagal mengubah kata sandi.')
    } else {
      flash(setPwMsg, 'Kata sandi berhasil diubah.')
      setPwForm({ current: '', next: '', confirm: '' })
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Memuat...</p>

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">Kelola profil dan akun Anda</p>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Informasi Profil</h2>
        <form onSubmit={handleProfile} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Nama Lengkap</label>
            <input required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">No. Telepon</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          {msg && <p className={`text-xs px-3 py-2 rounded-xl ${msg.includes('berhasil') ? 'bg-chart-4/10 text-chart-4' : 'bg-destructive/10 text-destructive'}`}>{msg}</p>}
          <button type="submit" disabled={saving}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </form>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Ubah Kata Sandi</h2>
        <form onSubmit={handlePassword} className="space-y-3">
          {[
            { key: 'next', label: 'Kata Sandi Baru' },
            { key: 'confirm', label: 'Konfirmasi Kata Sandi' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-foreground mb-1">{label}</label>
              <input
                type="password"
                value={pwForm[key as keyof typeof pwForm]}
                onChange={(e) => setPwForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          ))}
          {pwMsg && <p className={`text-xs px-3 py-2 rounded-xl ${pwMsg.includes('berhasil') ? 'bg-chart-4/10 text-chart-4' : 'bg-destructive/10 text-destructive'}`}>{pwMsg}</p>}
          <button type="submit" disabled={savingPw}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {savingPw ? 'Menyimpan...' : 'Ubah Kata Sandi'}
          </button>
        </form>
      </div>
    </div>
  )
}
