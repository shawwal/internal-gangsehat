'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, Plus, HeartPulse } from 'lucide-react'
import { fetchPatients, addPatient, type PatientPlain } from '@/app/actions/patients'

export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientPlain[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({
    name: '', birthDate: '', gender: 'male' as 'male' | 'female' | 'other',
    phone: '', address: '',
  })
  const [saving, setSaving] = useState(false)

  async function load() {
    const data = await fetchPatients()
    setPatients(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.phone ?? '').includes(search)
  )

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await addPatient({
      name:      form.name,
      phone:     form.phone,
      address:   form.address || undefined,
      birthDate: form.birthDate || undefined,
      gender:    form.gender,
    })
    setSaving(false)
    if (error) { alert(error); return }
    setShowForm(false)
    setForm({ name: '', birthDate: '', gender: 'male', phone: '', address: '' })
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pasien</h1>
          <p className="text-sm text-muted-foreground">Data pasien</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, telepon..."
              className="w-full pl-8 pr-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus size={16} /> Tambah
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/patients/${p.id}`}
              className="bg-card rounded-2xl border border-border p-4 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <HeartPulse size={16} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.name}</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                {p.phone && <p>📞 {p.phone}</p>}
                {p.birthDate && <p>🎂 {p.birthDate}</p>}
                {p.gender && <p className="capitalize">⚧ {p.gender === 'male' ? 'Laki-laki' : p.gender === 'female' ? 'Perempuan' : 'Lainnya'}</p>}
              </div>
            </Link>
          ))}
          {!filtered.length && (
            <p className="text-sm text-muted-foreground col-span-3 text-center py-8">Tidak ada pasien ditemukan.</p>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-foreground mb-4">Tambah Pasien</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Nama Lengkap</label>
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Tanggal Lahir</label>
                  <input type="date" value={form.birthDate} onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Jenis Kelamin</label>
                  <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as 'male' | 'female' | 'other' }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="male">Laki-laki</option>
                    <option value="female">Perempuan</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Telepon</label>
                <input type="tel" required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Alamat</label>
                <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Batal</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
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
