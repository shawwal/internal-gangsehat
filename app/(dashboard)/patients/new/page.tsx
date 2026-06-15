'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, CheckCircle, Loader2, ArrowLeft } from 'lucide-react'
import { addPatient } from '@/app/actions/patients'

type Gender = 'male' | 'female' | 'other'

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male',   label: 'Laki-laki' },
  { value: 'female', label: 'Perempuan' },
  { value: 'other',  label: 'Lainnya' },
]

const AGAMA_OPTIONS = [
  'ISLAM', 'KRISTEN PROTESTAN', 'KRISTEN KATOLIK',
  'HINDU', 'BUDHA', 'KONGHUCU', 'LAINNYA',
]

const inputClass =
  'w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow'

const labelClass = 'block text-sm font-medium text-foreground mb-1.5'

function NewPatientPageInner() {
  const searchParams = useSearchParams()
  const fromJadwal = searchParams.get('source') === 'jadwal'

  const [name, setName]               = useState('')
  const [phone, setPhone]             = useState('')
  const [gender, setGender]           = useState<Gender | null>(null)
  const [birthDate, setBirth]         = useState('')
  const [address, setAddress]         = useState('')
  const [kelurahan, setKelurahan]     = useState('')
  const [kecamatan, setKecamatan]     = useState('')
  const [kabupatenKota, setKabupaten] = useState('')
  const [provinsi, setProvinsi]       = useState('')
  const [agama, setAgama]             = useState('')
  const [pekerjaan, setPekerjaan]     = useState('')
  const [hobi, setHobi]               = useState('')

  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [createdId, setCreatedId]     = useState<string | null>(null)
  const [createdName, setCreatedName] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim())  { setError('Nama lengkap wajib diisi.'); return }
    if (!phone.trim()) { setError('Nomor HP/WhatsApp wajib diisi.'); return }
    if (!gender)       { setError('Jenis kelamin wajib dipilih.'); return }
    if (!birthDate)    { setError('Tanggal lahir wajib diisi.'); return }
    if (!address.trim())      { setError('Alamat wajib diisi.'); return }
    if (!kelurahan.trim())    { setError('Kelurahan/Desa wajib diisi.'); return }
    if (!kecamatan.trim())    { setError('Kecamatan wajib diisi.'); return }
    if (!kabupatenKota.trim()) { setError('Kabupaten/Kota wajib diisi.'); return }
    if (!provinsi.trim())     { setError('Provinsi wajib diisi.'); return }
    if (!agama)               { setError('Agama wajib dipilih.'); return }
    if (!pekerjaan.trim())    { setError('Pekerjaan wajib diisi.'); return }
    if (!hobi.trim())         { setError('Hobi/Aktivitas wajib diisi.'); return }

    setSaving(true)
    setError(null)

    const { error: err, id } = await addPatient({
      name:          name.trim(),
      phone:         phone.trim(),
      gender,
      birthDate,
      address:       address.trim(),
      kelurahan:     kelurahan.trim(),
      kecamatan:     kecamatan.trim(),
      kabupaten_kota: kabupatenKota.trim(),
      provinsi:      provinsi.trim(),
      agama,
      pekerjaan:     pekerjaan.trim(),
      hobi:          hobi.trim(),
    })

    setSaving(false)

    if (err) {
      setError(err)
      return
    }

    setCreatedId(id)
    setCreatedName(name.trim())

    // Reset form
    setName(''); setPhone(''); setGender(null); setBirth('')
    setAddress(''); setKelurahan(''); setKecamatan('')
    setKabupaten(''); setProvinsi(''); setAgama('')
    setPekerjaan(''); setHobi('')
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <UserPlus size={20} className="text-primary" />
          Pendaftaran Pasien Baru
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Isi semua data sesuai KTP. Gunakan huruf kapital.
        </p>
      </div>

      {/* Success banner */}
      {createdId && (
        <div className="glass-card p-5 mb-6 border border-green-500/30 bg-green-500/5">
          <div className="flex items-start gap-3">
            <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                Pasien &quot;{createdName}&quot; berhasil didaftarkan
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Link
                  href={`/patients/${createdId}`}
                  className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
                >
                  Lihat Data Pasien
                </Link>
                {fromJadwal && (
                  <Link
                    href="/jadwal-harian"
                    className="px-4 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors"
                  >
                    Kembali ke Jadwal
                  </Link>
                )}
                <button
                  onClick={() => setCreatedId(null)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors cursor-pointer"
                >
                  Daftarkan Pasien Lain
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
        {/* Nama */}
        <div>
          <label className={labelClass}>
            Nama Lengkap <span className="text-destructive">*</span>
            <span className="text-xs font-normal text-muted-foreground ml-1">— sesuai KTP</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: BUDI SANTOSO"
            className={inputClass}
          />
        </div>

        {/* Tanggal lahir & Jenis kelamin */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              Tanggal Lahir <span className="text-destructive">*</span>
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirth(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              Jenis Kelamin <span className="text-destructive">*</span>
            </label>
            <div className="flex gap-2">
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGender(opt.value)}
                  className={[
                    'flex-1 py-2.5 rounded-xl text-xs font-medium border transition-all duration-200 cursor-pointer',
                    gender === opt.value
                      ? opt.value === 'male'
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                        : opt.value === 'female'
                        ? 'bg-primary/20 text-primary border-primary/40'
                        : 'bg-muted text-foreground border-border'
                      : 'border-border text-muted-foreground hover:bg-white/5',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* No HP */}
        <div>
          <label className={labelClass}>
            No. HP/WhatsApp <span className="text-destructive">*</span>
            <span className="text-xs font-normal text-muted-foreground ml-1">— angka saja tanpa pemisah/spasi</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08xxxxxxxxxx"
            className={inputClass}
          />
        </div>

        <hr className="border-border/40" />

        {/* Alamat */}
        <div>
          <label className={labelClass}>
            Alamat <span className="text-destructive">*</span>
            <span className="text-xs font-normal text-muted-foreground ml-1">— sesuai KTP</span>
          </label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Jl. Contoh No. 1, RT 01/RW 02"
            rows={2}
            className={inputClass + ' resize-none'}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              Kelurahan/Desa <span className="text-destructive">*</span>
            </label>
            <input
              value={kelurahan}
              onChange={(e) => setKelurahan(e.target.value)}
              placeholder="Sesuai KTP"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              Kecamatan <span className="text-destructive">*</span>
            </label>
            <input
              value={kecamatan}
              onChange={(e) => setKecamatan(e.target.value)}
              placeholder="Sesuai KTP"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              Kabupaten/Kota <span className="text-destructive">*</span>
            </label>
            <input
              value={kabupatenKota}
              onChange={(e) => setKabupaten(e.target.value)}
              placeholder="Sesuai KTP"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              Provinsi <span className="text-destructive">*</span>
            </label>
            <input
              value={provinsi}
              onChange={(e) => setProvinsi(e.target.value)}
              placeholder="Sesuai KTP"
              className={inputClass}
            />
          </div>
        </div>

        <hr className="border-border/40" />

        {/* Agama & Pekerjaan */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              Agama <span className="text-destructive">*</span>
            </label>
            <select
              value={agama}
              onChange={(e) => setAgama(e.target.value)}
              className={inputClass}
            >
              <option value="">Pilih agama...</option>
              {AGAMA_OPTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>
              Pekerjaan <span className="text-destructive">*</span>
            </label>
            <input
              value={pekerjaan}
              onChange={(e) => setPekerjaan(e.target.value)}
              placeholder="Contoh: WIRASWASTA"
              className={inputClass}
            />
          </div>
        </div>

        {/* Hobi */}
        <div>
          <label className={labelClass}>
            Hobi/Aktivitas Sehari-hari <span className="text-destructive">*</span>
            <span className="text-xs font-normal text-muted-foreground ml-1">— yang mungkin berhubungan dengan keluhan</span>
          </label>
          <input
            value={hobi}
            onChange={(e) => setHobi(e.target.value)}
            placeholder="Contoh: BEROLAHRAGA, DUDUK LAMA"
            className={inputClass}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-xl">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Link
            href={fromJadwal ? '/jadwal-harian' : '/patients'}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            <ArrowLeft size={14} />
            Kembali
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <UserPlus size={14} />
                Daftarkan Pasien
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function NewPatientPage() {
  return (
    <Suspense>
      <NewPatientPageInner />
    </Suspense>
  )
}
