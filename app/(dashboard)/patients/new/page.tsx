'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, CheckCircle, Loader2, ArrowLeft } from 'lucide-react'
import { addPatient } from '@/app/actions/patients'
import {
  AddPatientFormFields,
  DEFAULT_ADD_PATIENT_FORM,
  type AddPatientFormData,
} from '@/components/patients/AddPatientFormFields'

function validate(form: AddPatientFormData): string | null {
  if (!form.name.trim())           return 'Nama lengkap wajib diisi.'
  if (!form.phone.trim())          return 'Nomor HP/WhatsApp wajib diisi.'
  if (!form.gender)                return 'Jenis kelamin wajib dipilih.'
  if (!form.birthDate)             return 'Tanggal lahir wajib diisi.'
  if (!form.address.trim())        return 'Alamat wajib diisi.'
  if (!form.provinsi.trim())       return 'Provinsi wajib diisi.'
  if (!form.kabupatenKota.trim())  return 'Kabupaten/Kota wajib diisi.'
  if (!form.kecamatan.trim())      return 'Kecamatan wajib diisi.'
  if (!form.kelurahan.trim())      return 'Kelurahan/Desa wajib diisi.'
  if (!form.agama)                 return 'Agama wajib dipilih.'
  if (!form.pekerjaan.trim())      return 'Pekerjaan wajib diisi.'
  if (!form.keluhan.trim())        return 'Keluhan wajib diisi.'
  if (!form.hobi.trim())           return 'Hobi/Aktivitas wajib diisi.'
  return null
}

type Source = 'jadwal' | 'patients' | null

function backHref(source: Source) {
  if (source === 'jadwal') return '/jadwal-harian'
  return '/patients'
}

function NewPatientPageInner() {
  const searchParams = useSearchParams()
  const source = searchParams.get('source') as Source

  const [form, setForm]           = useState<AddPatientFormData>(DEFAULT_ADD_PATIENT_FORM)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [createdName, setCreated] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate(form)
    if (err) { setError(err); return }

    setSaving(true)
    setError(null)

    const { error: apiErr, id } = await addPatient({
      name:           form.name.trim(),
      phone:          form.phone.trim(),
      gender:         form.gender!,
      birthDate:      form.birthDate,
      address:        form.address.trim(),
      kelurahan:      form.kelurahan.trim(),
      kecamatan:      form.kecamatan.trim(),
      kabupaten_kota: form.kabupatenKota.trim(),
      provinsi:       form.provinsi.trim(),
      agama:          form.agama,
      pekerjaan:      form.pekerjaan.trim(),
      hobi:           form.hobi.trim(),
      keluhan:        form.keluhan.trim(),
    })

    setSaving(false)

    if (apiErr) { setError(apiErr); return }

    setCreatedId(id)
    setCreated(form.name.trim())
    setForm(DEFAULT_ADD_PATIENT_FORM)
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">

      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={backHref(source)}
          className="p-2 rounded-xl border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <UserPlus size={20} className="text-primary" />
            Pendaftaran Pasien Baru
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Isi semua data sesuai KTP. Gunakan huruf kapital.
          </p>
        </div>
      </div>

      {/* Success banner */}
      {createdId && (
        <div className="glass-card p-5 mb-6 border border-green-500/30 bg-green-500/5 animate-in fade-in slide-in-from-top-2 duration-300">
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
                {source === 'jadwal' && (
                  <Link
                    href="/jadwal-harian"
                    className="px-4 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors"
                  >
                    Kembali ke Jadwal
                  </Link>
                )}
                {(source === 'patients' || !source) && (
                  <Link
                    href="/patients"
                    className="px-4 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors"
                  >
                    Kembali ke Daftar Pasien
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
        <AddPatientFormFields form={form} onChange={setForm} />

        {error && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            <p className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-xl border border-destructive/20">
              {error}
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Link
            href={backHref(source)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            <ArrowLeft size={14} />
            Batal
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
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
