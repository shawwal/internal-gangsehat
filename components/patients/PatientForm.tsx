'use client'

import { X } from 'lucide-react'

export interface PatientFormData {
  name:      string
  birthDate: string
  gender:    'male' | 'female' | 'other'
  phone:     string
  address:   string
}

export const DEFAULT_PATIENT_FORM: PatientFormData = {
  name:      '',
  birthDate: '',
  gender:    'male',
  phone:     '',
  address:   '',
}

interface Props {
  form:     PatientFormData
  saving:   boolean
  onClose:  () => void
  onChange: (form: PatientFormData) => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
}

export function PatientForm({ form, saving, onClose, onChange, onSubmit }: Props) {
  return (
    <div className="glass-card p-5 space-y-4">
      {/* Form header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Form Tambah Pasien</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Isi data pasien di bawah dan klik simpan
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground cursor-pointer"
          aria-label="Tutup form"
        >
          <X size={15} />
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="pf-name" className="block text-xs font-medium text-foreground mb-1.5">
            Nama Lengkap
          </label>
          <input
            id="pf-name"
            required
            value={form.name}
            onChange={e => onChange({ ...form, name: e.target.value })}
            placeholder="Masukkan nama lengkap pasien"
            className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Birth date + gender */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="pf-dob" className="block text-xs font-medium text-foreground mb-1.5">
              Tanggal Lahir
            </label>
            <input
              id="pf-dob"
              type="date"
              value={form.birthDate}
              onChange={e => onChange({ ...form, birthDate: e.target.value })}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="pf-gender" className="block text-xs font-medium text-foreground mb-1.5">
              Jenis Kelamin
            </label>
            <select
              id="pf-gender"
              value={form.gender}
              onChange={e => onChange({ ...form, gender: e.target.value as PatientFormData['gender'] })}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
            >
              <option value="male">Laki-laki</option>
              <option value="female">Perempuan</option>
              <option value="other">Lainnya</option>
            </select>
          </div>
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="pf-phone" className="block text-xs font-medium text-foreground mb-1.5">
            Telepon
          </label>
          <input
            id="pf-phone"
            type="tel"
            required
            value={form.phone}
            onChange={e => onChange({ ...form, phone: e.target.value })}
            placeholder="Contoh: 08123456789"
            className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Address */}
        <div>
          <label htmlFor="pf-address" className="block text-xs font-medium text-foreground mb-1.5">
            Alamat{' '}
            <span className="text-muted-foreground font-normal">(opsional)</span>
          </label>
          <textarea
            id="pf-address"
            value={form.address}
            onChange={e => onChange({ ...form, address: e.target.value })}
            rows={2}
            placeholder="Alamat lengkap pasien..."
            className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {saving ? 'Menyimpan...' : 'Simpan Pasien'}
          </button>
        </div>
      </form>
    </div>
  )
}
