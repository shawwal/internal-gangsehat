'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Save, X } from 'lucide-react'
import {
  approveRegistration,
  updateRegistration,
  type RegistrationFields,
  type RegistrationRow,
} from '@/app/actions/patientRegistrations'
import {
  AddPatientFormFields,
  validateAddPatientForm,
  type AddPatientFormData,
} from '@/components/patients/AddPatientFormFields'
import { ConfirmDialog } from '@/components/leave/ConfirmDialog'

interface Props {
  row: RegistrationRow
  onClose: () => void
  /** Called after a save (patientId null) or approval (patientId set). */
  onDone: (patientId: string | null) => void
}

function toForm(row: RegistrationRow): AddPatientFormData {
  return {
    name: row.name, phone: row.phone, gender: row.gender, birthDate: row.birthDate,
    address: row.address, provinsi: row.provinsi, kabupatenKota: row.kabupatenKota,
    kecamatan: row.kecamatan, kelurahan: row.kelurahan, agama: row.agama,
    pekerjaan: row.pekerjaan, keluhan: row.keluhan, hobi: row.hobi,
    namaPanggilan: row.namaPanggilan, namaIbu: row.namaIbu, pekerjaanIbu: row.pekerjaanIbu,
    namaAyah: row.namaAyah, pekerjaanAyah: row.pekerjaanAyah, sumber: row.sumber,
  }
}

function toFields(form: AddPatientFormData): RegistrationFields {
  const t = (v: string) => v.trim()
  return {
    name: t(form.name), phone: t(form.phone), gender: form.gender, birthDate: form.birthDate,
    address: t(form.address), provinsi: t(form.provinsi), kabupatenKota: t(form.kabupatenKota),
    kecamatan: t(form.kecamatan), kelurahan: t(form.kelurahan), agama: form.agama,
    pekerjaan: t(form.pekerjaan), keluhan: t(form.keluhan), hobi: t(form.hobi),
    namaPanggilan: t(form.namaPanggilan), namaIbu: t(form.namaIbu), pekerjaanIbu: t(form.pekerjaanIbu),
    namaAyah: t(form.namaAyah), pekerjaanAyah: t(form.pekerjaanAyah), sumber: form.sumber,
  }
}

export function ReviewDialog({ row, onClose, onDone }: Props) {
  const [form, setForm]       = useState<AddPatientFormData>(() => toForm(row))
  const [noRm, setNoRm]       = useState('')
  const [busy, setBusy]       = useState<'save' | 'approve' | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy && !confirm) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, confirm, onClose])

  async function handleSave() {
    setBusy('save')
    setError(null)
    const { error: err } = await updateRegistration(row.id, toFields(form))
    setBusy(null)
    if (err) { setError(err); return }
    onDone(null)
  }

  function requestApprove() {
    const err = validateAddPatientForm(form, row.type)
    if (err) { setError(err); return }
    setError(null)
    setConfirm(true)
  }

  async function handleApprove() {
    setBusy('approve')
    const { error: err, patientId } = await approveRegistration(row.id, { ...toFields(form), no_rm: noRm.trim() })
    setBusy(null)
    setConfirm(false)
    if (err) { setError(err); return }
    onDone(patientId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-background w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-border shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {row.isGriya ? 'Tinjau Pendaftaran Griya Anak' : 'Tinjau Pendaftaran'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Periksa & perbaiki data sebelum dijadikan pasien.{row.branchName ? ` Cabang: ${row.branchName}.` : ''}
            </p>
            {row.isGriya && (
              <p className="text-xs text-primary font-medium mt-1">
                Pendaftaran anak — setelah disetujui, otomatis masuk daftar Siswa Griya Anak.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={!!busy}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              No. RM <span className="text-muted-foreground font-normal">(opsional)</span>
            </label>
            <input
              value={noRm}
              onChange={e => setNoRm(e.target.value.toUpperCase())}
              placeholder="cth. Z0922105765"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50"
            />
          </div>

          <AddPatientFormFields form={form} onChange={setForm} variant={row.type} />

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-xl border border-destructive/20">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 p-5 border-t border-border">
          <button
            onClick={handleSave}
            disabled={!!busy}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
          >
            {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Simpan Perubahan
          </button>
          <button
            onClick={requestApprove}
            disabled={!!busy}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            <CheckCircle2 size={14} />
            {row.isGriya ? 'Setujui & Jadikan Siswa' : 'Setujui & Jadikan Pasien'}
          </button>
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          title="Setujui Pendaftaran"
          description={`"${form.name.trim()}" akan ditambahkan sebagai pasien baru${row.isGriya ? ' dan siswa Griya Anak' : ''}${noRm.trim() ? ` dengan No. RM ${noRm.trim()}` : ''}. Lanjutkan?`}
          confirmLabel="Setujui"
          loading={busy === 'approve'}
          onConfirm={handleApprove}
          onCancel={() => setConfirm(false)}
          zIndexClass="z-[60]"
        />
      )}
    </div>
  )
}
