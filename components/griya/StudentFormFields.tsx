'use client'

import { AGAMA_OPTIONS } from '@/components/patients/detail/constants'
import { SUMBER_OPTIONS } from '@/lib/griyaSumber'

export const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
export const labelCls = 'block text-xs font-medium text-muted-foreground mb-1'

/** Every editable "PASIEN" field for a Griya Anak child. Subset of UpdatePatientInput. */
export interface StudentFormValue {
  name: string
  phone: string
  no_rm?: string
  birthDate?: string
  gender?: 'male' | 'female' | 'other'
  agama?: string
  sumber?: string
  nama_ibu?: string
  pekerjaan_ibu?: string
  nama_ayah?: string
  pekerjaan_ayah?: string
  hobi?: string
  keluhan?: string
  medical_notes?: string
  address?: string
  kelurahan?: string
  kecamatan?: string
  kabupaten_kota?: string
  provinsi?: string
}

interface Props {
  value: StudentFormValue
  onChange: (key: keyof StudentFormValue, value: string) => void
  showRm?: boolean
}

export function StudentFormFields({ value, onChange, showRm }: Props) {
  const v = (k: keyof StudentFormValue) => (value[k] ?? '') as string
  const set = (k: keyof StudentFormValue) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange(k, e.target.value)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={labelCls}>Nama Anak *</label>
        <input value={v('name')} onChange={set('name')} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>No. WA Orang Tua *</label>
        <input value={v('phone')} onChange={set('phone')} className={inputCls} />
      </div>
      {showRm && (
        <div>
          <label className={labelCls}>No. Rekam Medis</label>
          <input value={v('no_rm')} onChange={set('no_rm')} className={inputCls} />
        </div>
      )}
      <div>
        <label className={labelCls}>Tanggal Lahir</label>
        <input type="date" value={v('birthDate')} onChange={set('birthDate')} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Jenis Kelamin</label>
        <select value={v('gender') || 'other'} onChange={set('gender')} className={inputCls}>
          <option value="male">Laki-laki</option>
          <option value="female">Perempuan</option>
          <option value="other">Lainnya</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Agama</label>
        <select value={v('agama')} onChange={set('agama')} className={inputCls}>
          <option value="">—</option>
          {AGAMA_OPTIONS.map((a: string) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Sumber (tahu dari mana)</label>
        <select value={(SUMBER_OPTIONS as readonly string[]).includes(v('sumber')) ? v('sumber') : (v('sumber') ? 'LAINNYA' : '')}
          onChange={set('sumber')} className={inputCls}>
          <option value="">—</option>
          {SUMBER_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div>
        <label className={labelCls}>Nama Ibu</label>
        <input value={v('nama_ibu')} onChange={set('nama_ibu')} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Pekerjaan Ibu</label>
        <input value={v('pekerjaan_ibu')} onChange={set('pekerjaan_ibu')} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Nama Ayah</label>
        <input value={v('nama_ayah')} onChange={set('nama_ayah')} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Pekerjaan Ayah</label>
        <input value={v('pekerjaan_ayah')} onChange={set('pekerjaan_ayah')} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Hobi / Aktivitas</label>
        <input value={v('hobi')} onChange={set('hobi')} className={inputCls} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Keluhan</label>
        <textarea value={v('keluhan')} onChange={set('keluhan')} rows={2} className={`${inputCls} resize-none`} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Catatan / Orang Tua</label>
        <textarea value={v('medical_notes')} onChange={set('medical_notes')} rows={2} className={`${inputCls} resize-none`} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Alamat</label>
        <input value={v('address')} onChange={set('address')} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Kelurahan / Desa</label>
        <input value={v('kelurahan')} onChange={set('kelurahan')} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Kecamatan</label>
        <input value={v('kecamatan')} onChange={set('kecamatan')} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Kabupaten / Kota</label>
        <input value={v('kabupaten_kota')} onChange={set('kabupaten_kota')} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Provinsi</label>
        <input value={v('provinsi')} onChange={set('provinsi')} className={inputCls} />
      </div>
    </div>
  )
}
