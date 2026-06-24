'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
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
  const successRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (createdId && successRef.current) {
      successRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [createdId])

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

  const header = (
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
  )

  if (createdId) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {header}

        <div
          ref={successRef}
          className="glass-card overflow-hidden animate-in fade-in zoom-in-95 duration-500"
        >
          {/* top accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-green-400 via-green-500 to-emerald-400" />

          <div className="p-10 flex flex-col items-center text-center">
            {/* animated circle + check */}
            <div className="relative mb-6 animate-in zoom-in duration-700 delay-100">
              <div className="w-24 h-24 rounded-full bg-green-500/10 border-2 border-green-500/20 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
                  <CheckCircle size={36} className="text-green-500 drop-shadow-sm" />
                </div>
              </div>
              {/* pulse ring */}
              <div className="absolute inset-0 rounded-full border-2 border-green-500/30 animate-ping opacity-30" />
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
              <p className="text-xs font-semibold uppercase tracking-widest text-green-500 mb-2">
                Pendaftaran Berhasil
              </p>
              <h2 className="text-2xl font-bold text-foreground mb-1">
                Pasien Terdaftar!
              </h2>
              <p className="text-muted-foreground text-sm max-w-sm">
                <span className="font-semibold text-foreground">&ldquo;{createdName}&rdquo;</span>{' '}
                telah berhasil didaftarkan ke dalam sistem.
              </p>
            </div>

            {/* divider */}
            <div className="w-16 h-px bg-border my-7 animate-in fade-in duration-500 delay-300" />

            {/* action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
              <Link
                href={`/patients/${createdId}`}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all duration-200"
              >
                <CheckCircle size={14} />
                Lihat Data Pasien
              </Link>
              <button
                onClick={() => setCreatedId(null)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-border text-sm font-medium hover:bg-muted active:scale-[0.98] transition-all duration-200 cursor-pointer"
              >
                <UserPlus size={14} />
                Daftar Lagi
              </button>
            </div>

            <div className="mt-3 w-full max-w-sm animate-in fade-in duration-500 delay-500">
              <Link
                href={source === 'jadwal' ? '/jadwal-harian' : '/patients'}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
              >
                <ArrowLeft size={13} />
                {source === 'jadwal' ? 'Kembali ke Jadwal Harian' : 'Kembali ke Daftar Pasien'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {header}

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
