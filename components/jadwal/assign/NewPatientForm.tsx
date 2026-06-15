'use client'

import { useState } from 'react'
import { ChevronLeft, UserPlus, Loader2 } from 'lucide-react'
import { addPatient, searchPatients, type PatientPlain } from '@/app/actions/patients'

interface Props {
  prefillName: string
  onCreated: (p: PatientPlain) => void
  onCancel: () => void
}

type Gender = 'male' | 'female' | 'other'

const GENDER_OPTIONS: { value: Gender; label: string; colorClass: string }[] = [
  { value: 'male',   label: 'Laki-laki',  colorClass: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  { value: 'female', label: 'Perempuan',  colorClass: 'bg-primary/20 text-primary border-primary/40' },
  { value: 'other',  label: 'Lainnya',    colorClass: 'bg-muted text-muted-foreground border-border' },
]

export function NewPatientForm({ prefillName, onCreated, onCancel }: Props) {
  const [name, setName]         = useState(prefillName)
  const [phone, setPhone]       = useState('')
  const [gender, setGender]     = useState<Gender | null>(null)
  const [birthDate, setBirth]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim())  { setError('Nama wajib diisi.'); return }
    if (!phone.trim()) { setError('Nomor telepon wajib diisi.'); return }
    if (!gender)       { setError('Jenis kelamin wajib dipilih.'); return }

    setSaving(true)
    setError(null)

    const { error: err } = await addPatient({
      name:      name.trim(),
      phone:     phone.trim(),
      gender,
      birthDate: birthDate || undefined,
    })

    if (err) {
      setError(err)
      setSaving(false)
      return
    }

    // Fetch the newly created patient to get the full PatientPlain
    const results = await searchPatients(name.trim())
    const created = results.find((p) => p.name.toLowerCase() === name.trim().toLowerCase()) ?? results[0]

    setSaving(false)
    if (created) {
      onCreated(created)
    } else {
      setError('Pasien berhasil dibuat, tetapi gagal dimuat. Coba cari manual.')
    }
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Back header */}
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground"
          aria-label="Kembali ke pencarian"
        >
          <ChevronLeft size={16} />
        </button>
        <div>
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <UserPlus size={14} className="text-primary" />
            Tambah Pasien Baru
          </p>
          <p className="text-xs text-muted-foreground">Isi data minimal untuk mendaftarkan pasien</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Nama Lengkap <span className="text-destructive">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Budi Santoso"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Nomor Telepon <span className="text-destructive">*</span>
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08xx-xxxx-xxxx"
            type="tel"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
          />
        </div>

        {/* Gender */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Jenis Kelamin <span className="text-destructive">*</span>
          </label>
          <div className="flex gap-2">
            {GENDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGender(opt.value)}
                className={[
                  'flex-1 py-2 rounded-xl text-xs font-medium border transition-all duration-200 cursor-pointer',
                  gender === opt.value
                    ? opt.colorClass
                    : 'border-border text-muted-foreground hover:bg-white/5',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Birth date (optional) */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Tanggal Lahir <span className="font-normal text-muted-foreground">(opsional)</span>
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirth(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <UserPlus size={13} />
                Daftarkan Pasien
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
