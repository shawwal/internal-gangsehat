'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Save, AlertTriangle, CheckCircle2,
  User, Phone, Home, Stethoscope, ChevronLeft,
} from 'lucide-react'
import { updatePatient, type UpdatePatientInput, type PatientPlain } from '@/app/actions/patients'
import { GENDER_OPTIONS, AGAMA_OPTIONS, BLOOD_TYPE_OPTIONS } from './constants'

// ─── Field helpers ────────────────────────────────────────────────────────────

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

const INPUT_CLS =
  'w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background ' +
  'focus:outline-none focus:ring-2 focus:ring-ring transition-colors duration-150'

const SELECT_CLS = INPUT_CLS + ' cursor-pointer'

// ─── Section wrapper ──────────────────────────────────────────────────────────

function FormSection({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="glass-card p-5 space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground border-b border-border/50 pb-3">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────

interface Props {
  patient: PatientPlain
}

export function PatientEditForm({ patient }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState<UpdatePatientInput>({
    name:             patient.name,
    phone:            patient.phone,
    address:          patient.address          ?? '',
    birthDate:        patient.birthDate        ?? '',
    gender:           patient.gender           ?? 'other',
    idNumber:         patient.idNumber         ?? '',
    emergencyContact: patient.emergencyContact ?? '',
    blood_type:       patient.blood_type       ?? '',
    allergies:        patient.allergies        ?? '',
    medical_notes:    patient.medical_notes    ?? '',
    no_rm:            patient.no_rm            ?? '',
    pekerjaan:        patient.pekerjaan        ?? '',
    agama:            patient.agama            ?? '',
    hobi:             patient.hobi             ?? '',
    kelurahan:        patient.kelurahan        ?? '',
    kecamatan:        patient.kecamatan        ?? '',
    kabupaten_kota:   patient.kabupaten_kota   ?? '',
    provinsi:         patient.provinsi         ?? '',
  })

  const set = (field: keyof UpdatePatientInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const payload: UpdatePatientInput = {
        ...form,
        address:          form.address          || undefined,
        birthDate:        form.birthDate        || undefined,
        idNumber:         form.idNumber         || undefined,
        emergencyContact: form.emergencyContact || undefined,
        blood_type:       form.blood_type       || undefined,
        allergies:        form.allergies        || undefined,
        medical_notes:    form.medical_notes    || undefined,
        no_rm:            form.no_rm            || undefined,
        pekerjaan:        form.pekerjaan        || undefined,
        agama:            form.agama            || undefined,
        hobi:             form.hobi             || undefined,
        kelurahan:        form.kelurahan        || undefined,
        kecamatan:        form.kecamatan        || undefined,
        kabupaten_kota:   form.kabupaten_kota   || undefined,
        provinsi:         form.provinsi         || undefined,
      }
      const { error: err } = await updatePatient(patient.id, payload)
      if (err) {
        setError(err)
      } else {
        setSaved(true)
        router.push(`/patients/${patient.id}`)
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Identitas ─────────────────────────────────────────────────────── */}
      <FormSection title="Identitas" icon={<User size={15} />}>
        <Field label="Nama Lengkap" required>
          <input
            value={form.name}
            onChange={set('name')}
            required
            placeholder="Nama lengkap pasien"
            className={INPUT_CLS}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="No. Rekam Medis" hint="Format: Z0922105765">
            <input
              value={form.no_rm}
              onChange={set('no_rm')}
              placeholder="Contoh: Z0922105765"
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Jenis Kelamin">
            <select value={form.gender} onChange={set('gender')} className={SELECT_CLS}>
              {GENDER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tanggal Lahir">
            <input
              type="date"
              value={form.birthDate}
              onChange={set('birthDate')}
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Golongan Darah">
            <select value={form.blood_type} onChange={set('blood_type')} className={SELECT_CLS}>
              <option value="">— Pilih —</option>
              {BLOOD_TYPE_OPTIONS.map(bt => (
                <option key={bt} value={bt}>{bt}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Agama">
            <select value={form.agama} onChange={set('agama')} className={SELECT_CLS}>
              <option value="">— Pilih —</option>
              {AGAMA_OPTIONS.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Field label="Pekerjaan">
            <input
              value={form.pekerjaan}
              onChange={set('pekerjaan')}
              placeholder="Pekerjaan pasien"
              className={INPUT_CLS}
            />
          </Field>
        </div>

        <Field label="Hobi">
          <input
            value={form.hobi}
            onChange={set('hobi')}
            placeholder="Opsional"
            className={INPUT_CLS}
          />
        </Field>
      </FormSection>

      {/* ── Kontak ────────────────────────────────────────────────────────── */}
      <FormSection title="Informasi Kontak" icon={<Phone size={15} />}>
        <Field label="No. Telepon" required>
          <input
            type="tel"
            value={form.phone}
            onChange={set('phone')}
            required
            placeholder="Contoh: 08123456789"
            className={INPUT_CLS}
          />
        </Field>

        <Field label="Alamat">
          <textarea
            value={form.address}
            onChange={set('address')}
            rows={3}
            placeholder="Alamat lengkap pasien..."
            className={INPUT_CLS + ' resize-none'}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="No. KTP / NIK">
            <input
              value={form.idNumber}
              onChange={set('idNumber')}
              placeholder="16-digit NIK"
              maxLength={16}
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Kontak Darurat">
            <input
              value={form.emergencyContact}
              onChange={set('emergencyContact')}
              placeholder="Nama & no. telepon"
              className={INPUT_CLS}
            />
          </Field>
        </div>
      </FormSection>

      {/* ── Domisili ──────────────────────────────────────────────────────── */}
      <FormSection title="Domisili" icon={<Home size={15} />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Kelurahan">
            <input value={form.kelurahan} onChange={set('kelurahan')} placeholder="Nama kelurahan" className={INPUT_CLS} />
          </Field>
          <Field label="Kecamatan">
            <input value={form.kecamatan} onChange={set('kecamatan')} placeholder="Nama kecamatan" className={INPUT_CLS} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Kabupaten / Kota">
            <input value={form.kabupaten_kota} onChange={set('kabupaten_kota')} placeholder="Nama kab./kota" className={INPUT_CLS} />
          </Field>
          <Field label="Provinsi">
            <input value={form.provinsi} onChange={set('provinsi')} placeholder="Nama provinsi" className={INPUT_CLS} />
          </Field>
        </div>
      </FormSection>

      {/* ── Catatan Medis ─────────────────────────────────────────────────── */}
      <FormSection title="Catatan Medis" icon={<Stethoscope size={15} />}>
        <Field label="Alergi">
          <input
            value={form.allergies}
            onChange={set('allergies')}
            placeholder="Contoh: Penisilin, seafood..."
            className={INPUT_CLS}
          />
          {form.allergies && (
            <p className="flex items-center gap-1.5 text-xs text-destructive mt-1">
              <AlertTriangle size={11} />
              Pastikan data alergi sudah benar sebelum menyimpan.
            </p>
          )}
        </Field>

        <Field label="Catatan Medis">
          <textarea
            value={form.medical_notes}
            onChange={set('medical_notes')}
            rows={4}
            placeholder="Catatan kondisi medis, riwayat penyakit, dll..."
            className={INPUT_CLS + ' resize-none'}
          />
        </Field>
      </FormSection>

      {/* ── Feedback + Actions ────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-chart-4/10 border border-chart-4/20 text-sm text-chart-4">
          <CheckCircle2 size={15} className="shrink-0" />
          Data berhasil disimpan. Mengalihkan...
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3 pb-4">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isPending || saved}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors duration-150 cursor-pointer disabled:opacity-40 min-h-[48px]"
        >
          <ChevronLeft size={15} />
          Batal
        </button>
        <button
          type="submit"
          disabled={isPending || saved}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors duration-150 cursor-pointer min-h-[48px]"
        >
          {isPending ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Menyimpan...
            </>
          ) : (
            <>
              <Save size={15} />
              Simpan Perubahan
            </>
          )}
        </button>
      </div>
    </form>
  )
}
