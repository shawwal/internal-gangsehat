'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Search, UserPlus } from 'lucide-react'
import { searchPatients, type PatientPlain } from '@/app/actions/patients'
import { createGriyaStudent, enrollGriyaStudent } from '@/app/actions/griyaStudents'
import { calcAge } from '@/components/patients/detail/constants'
import { useToast } from '@/context/ToastContext'

const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
const labelCls = 'block text-xs font-medium text-muted-foreground mb-1'

interface Props {
  branchId: string
  onClose: () => void
  onDone: () => void
}

export function AddStudentDialog({ branchId, onClose, onDone }: Props) {
  const { showToast } = useToast()
  const [tab, setTab] = useState<'new' | 'existing'>('new')

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-md max-h-[85vh] flex flex-col p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Tambah Siswa</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tab === 'new' ? 'Daftarkan anak baru sebagai siswa Griya Anak.' : 'Cari pasien yang sudah ada untuk dijadikan siswa.'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        <div className="flex gap-2 mb-3">
          {(['new', 'existing'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                tab === t ? 'bg-primary/10 text-primary border-primary/40' : 'border-border text-muted-foreground hover:bg-muted'
              }`}>
              {t === 'new' ? <UserPlus size={13} /> : <Search size={13} />}
              {t === 'new' ? 'Anak baru' : 'Pasien lama'}
            </button>
          ))}
        </div>

        {tab === 'new'
          ? <NewChildForm branchId={branchId} onDone={(name) => { showToast(`${name} ditambahkan`, 'success'); onDone() }} />
          : <ExistingPatientSearch branchId={branchId} onDone={(name) => { showToast(`${name} ditambahkan`, 'success'); onDone() }} />}
      </div>
    </div>
  )
}

function NewChildForm({ branchId, onDone }: { branchId: string; onDone: (name: string) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male')
  const [birthDate, setBirthDate] = useState('')
  const [keluhan, setKeluhan] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { setTimeout(() => ref.current?.focus(), 80) }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) { setError('Nama dan No. WA wajib diisi.'); return }
    setSaving(true); setError(null)
    const { error } = await createGriyaStudent({ name, phone, gender, birthDate, keluhan }, branchId)
    setSaving(false)
    if (error) { setError(error); return }
    onDone(name.trim())
  }

  return (
    <form onSubmit={submit} className="flex-1 overflow-y-auto space-y-3">
      <div>
        <label className={labelCls}>Nama Anak *</label>
        <input ref={ref} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>No. WA Orang Tua *</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Jenis Kelamin</label>
          <select value={gender} onChange={(e) => setGender(e.target.value as typeof gender)} className={inputCls}>
            <option value="male">Laki-laki</option>
            <option value="female">Perempuan</option>
            <option value="other">Lainnya</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Tanggal Lahir</label>
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Keluhan</label>
        <textarea value={keluhan} onChange={(e) => setKeluhan(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <button type="submit" disabled={saving}
        className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
        {saving ? 'Menyimpan...' : 'Simpan'}
      </button>
    </form>
  )
}

function ExistingPatientSearch({ branchId, onDone }: { branchId: string; onDone: (name: string) => void }) {
  const { showToast } = useToast()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<PatientPlain[]>([])
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { setTimeout(() => ref.current?.focus(), 80) }, [])
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setResults([]); return }
    const t = setTimeout(() => { searchPatients(term).then((r) => setResults(r.slice(0, 15))) }, 300)
    return () => clearTimeout(t)
  }, [q])

  async function enroll(p: PatientPlain) {
    setBusy(true)
    const { error } = await enrollGriyaStudent(p.id, branchId, 'manual')
    setBusy(false)
    if (error) { showToast(error, 'error'); return }
    onDone(p.name)
  }

  return (
    <>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ketik nama..."
          className="w-full pl-8 pr-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <div className="flex-1 overflow-y-auto mt-2 space-y-1 min-h-[120px]">
        {q.trim().length >= 2 && results.length === 0 && (
          <p className="text-xs text-muted-foreground px-1">Tidak ada pasien dengan nama itu.</p>
        )}
        {results.map((p) => (
          <button key={p.id} disabled={busy} onClick={() => enroll(p)}
            className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-muted cursor-pointer disabled:opacity-50">
            {p.name}
            {p.birthDate && <span className="text-xs text-muted-foreground ml-2">{calcAge(p.birthDate)}</span>}
          </button>
        ))}
      </div>
    </>
  )
}
