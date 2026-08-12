'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activityLog'
import { fetchBranchStaff, type BranchStaffMember } from '@/app/actions/jadwal'
import type { PatientPlain } from '@/app/actions/patients'
import { PatientPickerStep } from '@/components/jadwal/buy-package/PatientPickerStep'
import type { BodyRegion, ServiceType, VisitStatus } from '@/types'
import {
  HOME_VISIT_SERVICE_TYPES, VISIT_FORM_DEFAULT, INPUT_CLS, LABEL_CLS,
} from './types'

const BODY_REGIONS: BodyRegion[] = [
  'HEAD', 'NECK', 'SHOULDER', 'UPPER ARM', 'ELBOW', 'LOWER ARM',
  'WRIST', 'HAND', 'SPINE', 'CHEST', 'UPPER BACK', 'LOWER BACK',
  'ABDOMINAL', 'HIP/PELVIC', 'THIGH', 'KNEE', 'CALF', 'ANKLE',
  'FOOT', 'CNS', 'PNS', 'SYSTEMIC', 'CARDIOVASCULAR', 'PULMONAL', 'PERFORMANCE',
]

const STATUS_OPTIONS: VisitStatus[] = ['scheduled', 'completed', 'cancelled', 'no_show']
const STATUS_LABEL: Record<VisitStatus, string> = {
  scheduled: 'Terjadwal', completed: 'Selesai', cancelled: 'Dibatalkan', no_show: 'Tidak Hadir',
}

interface Props {
  patient?: PatientPlain | null
  branchId: string | null
  onClose: () => void
  onSuccess: () => void
}

export function RecordVisitDialog({ patient: initialPatient, branchId, onClose, onSuccess }: Props) {
  const [patient, setPatient] = useState<PatientPlain | null>(initialPatient ?? null)
  const [branchStaff, setBranchStaff] = useState<BranchStaffMember[]>([])
  const [form, setForm] = useState(VISIT_FORM_DEFAULT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (branchId) fetchBranchStaff(branchId).then(setBranchStaff)
  }, [branchId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!patient) { setError('Pilih pasien terlebih dahulu.'); return }
    if (!branchId) { setError('Akun Anda belum terhubung ke cabang.'); return }
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: inserted, error: insertErr } = await supabase.from('patient_visits').insert({
      patient_id:         patient.id,
      branch_id:          branchId,
      attending_staff_id: form.attending_staff_id || user?.id,
      visit_date:         form.visit_date,
      service_type:       form.service_type    || null,
      shift:              form.shift           || null,
      kehadiran:          form.kehadiran       || null,
      regio:              form.regio           || null,
      sumber_pasien:      form.sumber_pasien   || null,
      chief_complaint:    form.chief_complaint || null,
      diagnosis:          form.diagnosis       || null,
      treatment:          form.treatment       || null,
      status:             form.status,
      notes:              form.notes           || null,
    }).select('id').single()

    if (insertErr) {
      setSaving(false)
      setError(insertErr.message)
      return
    }

    if (inserted?.id) {
      await logActivity({
        supabase, userId: user?.id, action: 'create', resourceType: 'patient_visit',
        resourceId: inserted.id, resourceLabel: patient.name, branchId,
        newValues: {
          visit_date: form.visit_date, service_type: form.service_type || null,
          shift: form.shift || null, status: form.status,
          attending_staff_id: form.attending_staff_id || user?.id,
        },
      })
    }

    setSaving(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <p className="text-sm font-semibold text-foreground">Catat Kunjungan Home Visit</p>
            <p className="text-xs text-muted-foreground">TA Visit / Sesi Visit / Paket Visit</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <form id="record-home-visit-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-3">
          {!initialPatient && (
            <PatientPickerStep patient={patient} onSelect={setPatient} />
          )}

          {patient && (
            <>
              {branchStaff.length > 0 && (
                <div>
                  <label className={LABEL_CLS}>Terapis / Staff</label>
                  <select
                    value={form.attending_staff_id}
                    onChange={(e) => setForm((f) => ({ ...f, attending_staff_id: e.target.value }))}
                    className={INPUT_CLS}
                  >
                    <option value="">Saya sendiri</option>
                    {branchStaff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Tanggal</label>
                  <input required type="date" value={form.visit_date}
                    onChange={(e) => setForm((f) => ({ ...f, visit_date: e.target.value }))}
                    className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Shift</label>
                  <select
                    value={form.shift}
                    onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value as typeof form.shift }))}
                    className={INPUT_CLS}
                  >
                    <option value="">— Pilih —</option>
                    <option value="PAGI">PAGI</option>
                    <option value="SORE">SORE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Layanan</label>
                  <select
                    value={form.service_type}
                    onChange={(e) => setForm((f) => ({ ...f, service_type: e.target.value as ServiceType | '' }))}
                    className={INPUT_CLS}
                  >
                    <option value="">— Pilih —</option>
                    {HOME_VISIT_SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>Kehadiran</label>
                  <select
                    value={form.kehadiran}
                    onChange={(e) => setForm((f) => ({ ...f, kehadiran: e.target.value as typeof form.kehadiran }))}
                    className={INPUT_CLS}
                  >
                    <option value="">— Pilih —</option>
                    <option value="HADIR">HADIR</option>
                    <option value="TIDAK HADIR">TIDAK HADIR</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Regio</label>
                  <select value={form.regio} onChange={(e) => setForm((f) => ({ ...f, regio: e.target.value as BodyRegion | '' }))} className={INPUT_CLS}>
                    <option value="">— Pilih —</option>
                    {BODY_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>Status</label>
                  <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as VisitStatus }))} className={INPUT_CLS}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Sumber Pasien</label>
                <input value={form.sumber_pasien} onChange={(e) => setForm((f) => ({ ...f, sumber_pasien: e.target.value }))}
                  placeholder="mis. Rekomendasi, sosial media"
                  className={INPUT_CLS} />
              </div>

              {([
                ['chief_complaint', 'Keluhan Utama'],
                ['diagnosis', 'Diagnosis'],
                ['treatment', 'Tindakan'],
                ['notes', 'Catatan'],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className={LABEL_CLS}>{label}</label>
                  <textarea
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    rows={2}
                    className={`${INPUT_CLS} resize-none`}
                  />
                </div>
              ))}
            </>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <div className="flex gap-2 px-5 py-4 border-t border-border shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
            Batal
          </button>
          <button type="submit" form="record-home-visit-form" disabled={saving || !patient}
            className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
