'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Branch } from '@/types'

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Branch | null>(null)
  const [form, setForm]         = useState({ name: '', address: '', phone: '' })
  const [saving, setSaving]     = useState(false)

  async function load() {
    const { data } = await createClient().from('branches').select('*').order('name')
    setBranches(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm({ name: '', address: '', phone: '' })
    setShowForm(true)
  }

  function openEdit(b: Branch) {
    setEditing(b)
    setForm({ name: b.name, address: b.address ?? '', phone: b.phone ?? '' })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    if (editing) {
      await supabase.from('branches').update({ name: form.name, address: form.address || null, phone: form.phone || null }).eq('id', editing.id)
    } else {
      await supabase.from('branches').insert({ name: form.name, address: form.address || null, phone: form.phone || null })
    }
    setSaving(false)
    setShowForm(false)
    load()
  }

  async function toggleActive(b: Branch) {
    await createClient().from('branches').update({ is_active: !b.is_active }).eq('id', b.id)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Cabang</h1>
          <p className="text-sm text-muted-foreground">Kelola cabang klinik Gangsehat</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} /> Tambah Cabang
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <div key={b.id} className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.phone ?? '—'}</p>
                  </div>
                </div>
                <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                  <Pencil size={14} />
                </button>
              </div>
              {b.address && <p className="text-xs text-muted-foreground mt-3">{b.address}</p>}
              <div className="flex items-center justify-between mt-4">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.is_active ? 'bg-chart-4/15 text-chart-4' : 'bg-muted text-muted-foreground'}`}>
                  {b.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
                <button
                  onClick={() => toggleActive(b)}
                  className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
                >
                  {b.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold text-foreground mb-4">
              {editing ? 'Edit Cabang' : 'Tambah Cabang'}
            </h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Nama Cabang</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Alamat</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Telepon</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
