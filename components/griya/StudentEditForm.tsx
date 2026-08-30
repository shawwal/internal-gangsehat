'use client'

import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { updatePatient, type UpdatePatientInput, type PatientPlain } from '@/app/actions/patients'
import { normalizeSumber } from '@/lib/griyaSumber'
import { StudentFormFields, type StudentFormValue } from './StudentFormFields'

interface Props {
  patient: PatientPlain
  onCancel: () => void
  onSaved: () => void
}

export function StudentEditForm({ patient, onCancel, onSaved }: Props) {
  const [form, setForm] = useState<UpdatePatientInput>({
    name: patient.name,
    phone: patient.phone,
    address: patient.address ?? '',
    birthDate: patient.birthDate ?? '',
    gender: patient.gender ?? 'other',
    idNumber: patient.idNumber ?? '',
    emergencyContact: patient.emergencyContact ?? '',
    blood_type: patient.blood_type ?? '',
    allergies: patient.allergies ?? '',
    medical_notes: patient.medical_notes ?? '',
    no_rm: patient.no_rm ?? '',
    pekerjaan: patient.pekerjaan ?? '',
    agama: patient.agama ?? '',
    hobi: patient.hobi ?? '',
    kelurahan: patient.kelurahan ?? '',
    kecamatan: patient.kecamatan ?? '',
    kabupaten_kota: patient.kabupaten_kota ?? '',
    provinsi: patient.provinsi ?? '',
    keluhan: patient.keluhan ?? '',
    nama_ibu: patient.nama_ibu ?? '',
    pekerjaan_ibu: patient.pekerjaan_ibu ?? '',
    nama_ayah: patient.nama_ayah ?? '',
    pekerjaan_ayah: patient.pekerjaan_ayah ?? '',
    sumber: normalizeSumber(patient.sumber) ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onChange = (k: keyof StudentFormValue, val: string) => setForm((f) => ({ ...f, [k]: val }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) { setError('Nama dan No. WA wajib diisi.'); return }
    setSaving(true); setError(null)
    const { error } = await updatePatient(patient.id, { ...form, sumber: normalizeSumber(form.sumber) ?? '' })
    setSaving(false)
    if (error) { setError(error); return }
    onSaved()
  }

  return (
    <form onSubmit={submit} className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Ubah Data Anak</h2>
        <button type="button" onClick={onCancel} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer"><X size={15} /></button>
      </div>

      <StudentFormFields value={form} onChange={onChange} showRm />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">Batal</button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
          <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </form>
  )
}
