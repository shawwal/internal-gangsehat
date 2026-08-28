'use client'

import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { updatePatient, type UpdatePatientInput, type PatientPlain } from '@/app/actions/patients'
import { AGAMA_OPTIONS } from '@/components/patients/detail/constants'

const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
const labelCls = 'block text-xs font-medium text-muted-foreground mb-1'

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
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof UpdatePatientInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) { setError('Nama dan No. WA wajib diisi.'); return }
    setSaving(true); setError(null)
    const { error } = await updatePatient(patient.id, form)
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Nama Anak *</label>
          <input value={form.name} onChange={set('name')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>No. WA Orang Tua *</label>
          <input value={form.phone} onChange={set('phone')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>No. Rekam Medis</label>
          <input value={form.no_rm} onChange={set('no_rm')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Tanggal Lahir</label>
          <input type="date" value={form.birthDate} onChange={set('birthDate')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Jenis Kelamin</label>
          <select value={form.gender} onChange={set('gender')} className={inputCls}>
            <option value="male">Laki-laki</option>
            <option value="female">Perempuan</option>
            <option value="other">Lainnya</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Agama</label>
          <select value={form.agama} onChange={set('agama')} className={inputCls}>
            <option value="">—</option>
            {AGAMA_OPTIONS.map((a: string) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Hobi / Aktivitas</label>
          <input value={form.hobi} onChange={set('hobi')} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Keluhan</label>
          <textarea value={form.keluhan} onChange={set('keluhan')} rows={2} className={`${inputCls} resize-none`} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Catatan / Orang Tua</label>
          <textarea value={form.medical_notes} onChange={set('medical_notes')} rows={2} className={`${inputCls} resize-none`} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Alamat</label>
          <input value={form.address} onChange={set('address')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Kelurahan / Desa</label>
          <input value={form.kelurahan} onChange={set('kelurahan')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Kecamatan</label>
          <input value={form.kecamatan} onChange={set('kecamatan')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Kabupaten / Kota</label>
          <input value={form.kabupaten_kota} onChange={set('kabupaten_kota')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Provinsi</label>
          <input value={form.provinsi} onChange={set('provinsi')} className={inputCls} />
        </div>
      </div>

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
