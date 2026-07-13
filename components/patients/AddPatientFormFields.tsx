'use client'

import { useMemo } from 'react'
import { RegionSelect } from '@/components/ui/RegionSelect'
import { PROVINSI, KABUPATEN_KOTA, getKabupatenByProvinsi, getKecamatanByKabupaten } from '@/lib/indonesia-regions'

export interface AddPatientFormData {
  name: string
  phone: string
  gender: 'male' | 'female' | 'other' | null
  birthDate: string
  address: string
  provinsi: string
  kabupatenKota: string
  kecamatan: string
  kelurahan: string
  agama: string
  pekerjaan: string
  keluhan: string
  hobi: string
}

export const DEFAULT_ADD_PATIENT_FORM: AddPatientFormData = {
  name: '', phone: '', gender: null, birthDate: '', address: '',
  provinsi: '', kabupatenKota: '', kecamatan: '', kelurahan: '',
  agama: '', pekerjaan: '', keluhan: '', hobi: '',
}

const AGAMA_OPTIONS = [
  'ISLAM', 'KRISTEN PROTESTAN', 'KRISTEN KATOLIK',
  'HINDU', 'BUDHA', 'KONGHUCU', 'LAINNYA',
]

const PROVINSI_NAMES = PROVINSI.map((p) => p.nama)

const inputCls =
  'w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all duration-200 ' +
  'placeholder:text-muted-foreground/50'

const labelCls = 'block text-sm font-medium text-foreground mb-1.5'

interface Props {
  form: AddPatientFormData
  onChange: (form: AddPatientFormData) => void
}

export function AddPatientFormFields({ form, onChange }: Props) {
  const set = <K extends keyof AddPatientFormData>(k: K, v: AddPatientFormData[K]) =>
    onChange({ ...form, [k]: v })

  const selectedProvinsiKode = useMemo(
    () => PROVINSI.find((p) => p.nama === form.provinsi)?.kode ?? null,
    [form.provinsi],
  )

  const kabupatenOptions = useMemo(
    () => selectedProvinsiKode
      ? getKabupatenByProvinsi(selectedProvinsiKode).map((k) => k.nama)
      : [],
    [selectedProvinsiKode],
  )

  const selectedKabupatenKode = useMemo(
    () => KABUPATEN_KOTA.find(
      (k) => k.provinsi_kode === selectedProvinsiKode && k.nama === form.kabupatenKota,
    )?.kode ?? null,
    [selectedProvinsiKode, form.kabupatenKota],
  )

  const kecamatanOptions = useMemo(
    () => selectedKabupatenKode
      ? getKecamatanByKabupaten(selectedKabupatenKode).map((k) => k.nama)
      : [],
    [selectedKabupatenKode],
  )

  function handleProvinsiChange(v: string) {
    onChange({ ...form, provinsi: v, kabupatenKota: '', kecamatan: '' })
  }

  function handleKabupatenChange(v: string) {
    onChange({ ...form, kabupatenKota: v, kecamatan: '' })
  }

  return (
    <div className="space-y-5">

      {/* ── Identitas ── */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '0ms' }}>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Identitas
        </p>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>
              Nama Lengkap <span className="text-destructive">*</span>
              <span className="text-xs font-normal text-muted-foreground ml-1">— sesuai KTP, huruf kapital</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Contoh: BUDI SANTOSO"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                Tanggal Lahir <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                value={form.birthDate}
                onChange={(e) => set('birthDate', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                Jenis Kelamin <span className="text-destructive">*</span>
              </label>
              <div className="flex gap-2">
                {([ ['male', 'Laki-laki'], ['female', 'Perempuan'], ['other', 'Lainnya'] ] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => set('gender', val)}
                    className={[
                      'flex-1 py-2.5 rounded-xl text-xs font-medium border transition-all duration-200 cursor-pointer',
                      form.gender === val
                        ? val === 'male'
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-sm'
                          : val === 'female'
                          ? 'bg-primary/20 text-primary border-primary/40 shadow-sm'
                          : 'bg-muted text-foreground border-border shadow-sm'
                        : 'border-border text-muted-foreground hover:bg-white/5 hover:border-border/80',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>
              No. HP/WhatsApp <span className="text-destructive">*</span>
              <span className="text-xs font-normal text-muted-foreground ml-1">— angka saja tanpa spasi/pemisah</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="08xxxxxxxxxx"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <hr className="border-border/40" />

      {/* ── Alamat ── */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '60ms' }}>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Alamat
        </p>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>
              Alamat <span className="text-destructive">*</span>
              <span className="text-xs font-normal text-muted-foreground ml-1">— sesuai KTP</span>
            </label>
            <textarea
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="Jl. Contoh No. 1, RT 01/RW 02"
              rows={2}
              className={inputCls + ' resize-none'}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                Provinsi <span className="text-destructive">*</span>
              </label>
              <RegionSelect
                options={PROVINSI_NAMES}
                value={form.provinsi}
                onChange={handleProvinsiChange}
                placeholder="Pilih provinsi..."
              />
            </div>
            <div>
              <label className={labelCls}>
                Kabupaten/Kota <span className="text-destructive">*</span>
              </label>
              <RegionSelect
                options={kabupatenOptions}
                value={form.kabupatenKota}
                onChange={handleKabupatenChange}
                placeholder={form.provinsi ? 'Pilih kab/kota...' : 'Pilih provinsi dulu'}
                disabled={!form.provinsi}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                Kecamatan <span className="text-destructive">*</span>
              </label>
              <RegionSelect
                options={kecamatanOptions}
                value={form.kecamatan}
                onChange={(v) => set('kecamatan', v)}
                placeholder={form.kabupatenKota ? 'Pilih atau ketik kecamatan...' : 'Pilih kab/kota dulu'}
                disabled={!form.kabupatenKota}
              />
            </div>
            <div>
              <label className={labelCls}>
                Kelurahan/Desa <span className="text-destructive">*</span>
              </label>
              <input
                value={form.kelurahan}
                onChange={(e) => set('kelurahan', e.target.value)}
                placeholder="Sesuai KTP"
                className={inputCls}
              />
            </div>
          </div>
        </div>
      </div>

      <hr className="border-border/40" />

      {/* ── Data Tambahan ── */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '120ms' }}>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Data Tambahan
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                Agama <span className="text-destructive">*</span>
              </label>
              <select
                value={form.agama}
                onChange={(e) => set('agama', e.target.value)}
                className={inputCls + ' cursor-pointer'}
              >
                <option value="">Pilih agama...</option>
                {AGAMA_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>
                Pekerjaan <span className="text-destructive">*</span>
              </label>
              <input
                value={form.pekerjaan}
                onChange={(e) => set('pekerjaan', e.target.value)}
                placeholder="Contoh: WIRASWASTA"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>
              Keluhan <span className="text-destructive">*</span>
              <span className="text-xs font-normal text-muted-foreground ml-1">— keluhan utama yang membawa pasien datang</span>
            </label>
            <textarea
              value={form.keluhan}
              onChange={(e) => set('keluhan', e.target.value)}
              placeholder="Contoh: NYERI PINGGANG BAWAH SEJAK 2 MINGGU"
              rows={2}
              className={inputCls + ' resize-none'}
            />
          </div>

          <div>
            <label className={labelCls}>
              Hobi/Aktivitas Sehari-hari <span className="text-destructive">*</span>
              <span className="text-xs font-normal text-muted-foreground ml-1">— yang mungkin berhubungan dengan keluhan</span>
            </label>
            <input
              value={form.hobi}
              onChange={(e) => set('hobi', e.target.value)}
              placeholder="Contoh: BEROLAHRAGA, DUDUK LAMA"
              className={inputCls}
            />
          </div>
        </div>
      </div>

    </div>
  )
}
