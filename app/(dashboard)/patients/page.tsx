'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2, HeartPulse, Phone, Cake, PlusCircle,
  Search, User, Users, X, XCircle,
} from 'lucide-react'
import { fetchPatients, addPatient, type PatientPlain } from '@/app/actions/patients'

type GenderFilter = 'all' | 'male' | 'female' | 'other'

const GENDER_LABEL: Record<string, string> = {
  male: 'Laki-laki',
  female: 'Perempuan',
  other: 'Lainnya',
}

const GENDER_TABS: { key: GenderFilter; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'male', label: 'Laki-laki' },
  { key: 'female', label: 'Perempuan' },
  { key: 'other', label: 'Lainnya' },
]

const AVATAR_COLORS: Record<string, string> = {
  male:   'bg-blue-500/15 text-blue-600',
  female: 'bg-primary/15 text-primary',
  other:  'bg-secondary/20 text-secondary-foreground',
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

const DEFAULT_FORM = { name: '', birthDate: '', gender: 'male' as 'male' | 'female' | 'other', phone: '', address: '' }

export default function PatientsPage() {
  const [patients, setPatients]   = useState<PatientPlain[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [activeTab, setActiveTab] = useState<GenderFilter>('all')
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState(DEFAULT_FORM)
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  async function load() {
    const data = await fetchPatients()
    setPatients(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function closeForm() {
    setShowForm(false)
    setForm(DEFAULT_FORM)
  }

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
    if (error) {
      showToast(error, false)
      return
    }
    showToast('Pasien berhasil ditambahkan!', true)
    closeForm()
    load()
  }

  const maleCount   = patients.filter(p => p.gender === 'male').length
  const femaleCount = patients.filter(p => p.gender === 'female').length
  const otherCount  = patients.filter(p => p.gender === 'other').length

  const filtered = patients.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.phone ?? '').includes(search)
    const matchTab = activeTab === 'all' || p.gender === activeTab
    return matchSearch && matchTab
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pasien</h1>
          <p className="text-sm text-muted-foreground">Kelola data pasien klinik</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0 shadow-sm"
        >
          <PlusCircle size={15} />
          {showForm ? 'Tutup Form' : 'Tambah Pasien'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-medium ${
          toast.ok
            ? 'bg-chart-4/10 text-chart-4 border border-chart-4/20'
            : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          {toast.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Inline Form */}
      {showForm && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Form Tambah Pasien</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Isi data pasien di bawah dan klik simpan</p>
            </div>
            <button
              onClick={closeForm}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              <X size={15} />
            </button>
          </div>

          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Nama Lengkap</label>
              <input
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Masukkan nama lengkap pasien"
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Tanggal Lahir</label>
                <input
                  type="date"
                  value={form.birthDate}
                  onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Jenis Kelamin</label>
                <select
                  value={form.gender}
                  onChange={e => setForm(f => ({ ...f, gender: e.target.value as 'male' | 'female' | 'other' }))}
                  className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="male">Laki-laki</option>
                  <option value="female">Perempuan</option>
                  <option value="other">Lainnya</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Telepon</label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="Contoh: 08123456789"
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Alamat <span className="text-muted-foreground font-normal">(opsional)</span></label>
              <textarea
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                rows={2}
                placeholder="Alamat lengkap pasien..."
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={closeForm}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {saving ? 'Menyimpan...' : 'Simpan Pasien'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="animate-pulse bg-muted rounded-3xl h-20" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Users size={17} className="text-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{patients.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Pasien</p>
            </div>
          </div>
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <User size={17} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{maleCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Laki-laki</p>
            </div>
          </div>
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <User size={17} className="text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{femaleCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Perempuan</p>
            </div>
          </div>
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0">
              <HeartPulse size={17} className="text-secondary-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{otherCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Lainnya</p>
            </div>
          </div>
        </div>
      )}

      {/* Search + Filter */}
      {!loading && patients.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama atau telepon..."
              className="w-full pl-8 pr-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Gender filter tabs */}
          <div className="flex flex-wrap gap-2">
            {GENDER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Patient Cards */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="animate-pulse bg-muted rounded-3xl h-28" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 px-4 bg-muted/30 rounded-3xl gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <HeartPulse size={22} className="text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {patients.length === 0 ? 'Belum ada data pasien' : 'Tidak ada pasien ditemukan'}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            {patients.length === 0
              ? 'Tambahkan pasien baru untuk memulai pencatatan kunjungan.'
              : 'Coba ubah kata kunci pencarian atau pilih filter yang lain.'}
          </p>
          {patients.length === 0 && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-1 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <PlusCircle size={14} /> Tambah Pasien Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => (
            <Link
              key={p.id}
              href={`/patients/${p.id}`}
              className="glass-card p-4 hover:border-primary/40 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold ${AVATAR_COLORS[p.gender ?? 'other']}`}>
                  {getInitials(p.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {p.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {GENDER_LABEL[p.gender ?? 'other'] ?? 'Lainnya'}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                {p.phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone size={11} className="shrink-0" />
                    <span className="truncate">{p.phone}</span>
                  </div>
                )}
                {p.birthDate && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Cake size={11} className="shrink-0" />
                    <span>{formatDate(p.birthDate)}</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
