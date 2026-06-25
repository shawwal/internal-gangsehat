'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { createPatientPackage, updatePatientPackage } from '@/app/actions/packages'
import { DEFAULT_FORM, INPUT_CLS, LABEL_CLS } from './types'
import type { PatientPackage, JenisPaket, PackageOperationalStatus, PackageCompletionStatus, PackageStatus, FormState } from './types'

interface PackageModalProps {
  editTarget: PatientPackage | null
  branchId:   string | null
  patientId:  string
  onClose:    () => void
  onSaved:    () => void
}

export function PackageModal({ editTarget, branchId, patientId, onClose, onSaved }: PackageModalProps) {
  const isEdit = !!editTarget
  const [form, setForm] = useState<FormState>(() =>
    editTarget
      ? {
          package_name:       editTarget.package_name,
          jenis_paket:        editTarget.jenis_paket ?? 'P1',
          mulai_paket:        editTarget.mulai_paket ?? 'NEW',
          operational_status: editTarget.operational_status,
          completion_status:  editTarget.completion_status ?? '',
          status:             editTarget.status,
          notes:              editTarget.notes ?? '',
        }
      : DEFAULT_FORM,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const sessionCount = form.jenis_paket === 'P1' ? 5 : 10

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.package_name.trim()) { setError('Nama paket wajib diisi.'); return }
    setSaving(true)
    setError(null)

    if (isEdit && editTarget) {
      const { error: err } = await updatePatientPackage(editTarget.id, {
        package_name:       form.package_name.trim(),
        jenis_paket:        form.jenis_paket,
        mulai_paket:        form.mulai_paket,
        operational_status: form.operational_status,
        completion_status:  form.completion_status || null,
        status:             form.status,
        notes:              form.notes.trim() || null,
      })
      if (err) { setError(err); setSaving(false); return }
    } else {
      const { error: err } = await createPatientPackage({
        patient_id:   patientId,
        branch_id:    branchId,
        package_name: form.package_name.trim(),
        jenis_paket:  form.jenis_paket,
        mulai_paket:  form.mulai_paket,
        notes:        form.notes.trim() || null,
      })
      if (err) { setError(err); setSaving(false); return }
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-foreground">
            {isEdit ? 'Edit Paket' : 'Tambah Paket Terapi'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form id="pkg-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className={LABEL_CLS}>Nama Paket</label>
            <input
              required
              type="text"
              placeholder="mis. Paket Fisio Lutut"
              value={form.package_name}
              onChange={(e) => set('package_name', e.target.value)}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Jenis Paket</label>
            <div className="grid grid-cols-2 gap-2">
              {(['P1', 'P2'] as JenisPaket[]).map((jp) => (
                <button
                  key={jp}
                  type="button"
                  onClick={() => set('jenis_paket', jp)}
                  className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    form.jenis_paket === jp
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {jp} <span className="font-normal">({jp === 'P1' ? 5 : 10} sesi)</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {sessionCount} sesi akan ditetapkan otomatis
            </p>
          </div>

          <div>
            <label className={LABEL_CLS}>Mulai Paket</label>
            <div className="grid grid-cols-2 gap-2">
              {(['NEW', 'EXT.'] as const).map((mp) => (
                <button
                  key={mp}
                  type="button"
                  onClick={() => set('mulai_paket', mp)}
                  className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    form.mulai_paket === mp
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {mp === 'NEW' ? 'NEW (Baru)' : 'EXT. (Lanjutan)'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>Status Operasional</label>
            <div className="grid grid-cols-3 gap-2">
              {(['ON', 'OFF', 'PENDING'] as PackageOperationalStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('operational_status', s)}
                  className={`py-2 rounded-xl border text-xs font-medium transition-colors ${
                    form.operational_status === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {isEdit && (
            <>
              <div>
                <label className={LABEL_CLS}>Status Paket</label>
                <select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value as PackageStatus)}
                  className={INPUT_CLS}
                >
                  <option value="active">Aktif</option>
                  <option value="completed">Selesai</option>
                  <option value="cancelled">Dibatalkan</option>
                </select>
              </div>

              <div>
                <label className={LABEL_CLS}>Status Penyelesaian</label>
                <select
                  value={form.completion_status}
                  onChange={(e) => set('completion_status', e.target.value as PackageCompletionStatus | '')}
                  className={INPUT_CLS}
                >
                  <option value="">— Pilih —</option>
                  <option value="LANJUT">Lanjut</option>
                  <option value="SEMBUH">Sembuh</option>
                  <option value="TIDAK LANJUT">Tidak Lanjut</option>
                  <option value="STOP">Stop</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className={LABEL_CLS}>Catatan</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              placeholder="Catatan tambahan (opsional)"
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            form="pkg-form"
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Menyimpan...' : isEdit ? 'Simpan' : 'Tambah'}
          </button>
        </div>
      </div>
    </div>
  )
}
