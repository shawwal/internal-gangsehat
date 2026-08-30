'use client'

import { useEffect, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { updateVisit, deleteVisit, fetchBranchStaff, type BranchStaffMember } from '@/app/actions/jadwal'
import { GRIYA_SERVICE_TYPES } from './types'
import type { VisitStatus } from '@/types'

export interface EditableVisit {
  id: string
  visit_date: string
  visit_time: string | null
  service_type: string | null
  status: string
  kehadiran: string | null
  notes: string | null
  attending_staff_id: string | null
  patient_name?: string | null
}

const STATUS_OPTIONS: { value: VisitStatus; label: string }[] = [
  { value: 'scheduled', label: 'Terjadwal' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
  { value: 'no_show', label: 'Tidak Hadir (Alpa)' },
  { value: 'rescheduled', label: 'Dijadwalkan Ulang' },
]

const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
const labelCls = 'block text-xs font-medium text-muted-foreground mb-1'

interface Props {
  visit: EditableVisit
  branchId: string
  onClose: () => void
  onSaved: () => void
}

export function EditVisitDialog({ visit, branchId, onClose, onSaved }: Props) {
  const [staff, setStaff] = useState<BranchStaffMember[]>([])
  const [form, setForm] = useState({
    visit_date: visit.visit_date,
    visit_time: visit.visit_time ?? '',
    service_type: visit.service_type ?? '',
    attending_staff_id: visit.attending_staff_id ?? '',
    kehadiran: visit.kehadiran ?? '',
    status: (visit.status as VisitStatus) ?? 'scheduled',
    notes: visit.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchBranchStaff(branchId).then(setStaff) }, [branchId])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  // service_type may be a legacy value not in GRIYA_SERVICE_TYPES — keep it selectable
  const serviceOptions = form.service_type && !GRIYA_SERVICE_TYPES.includes(form.service_type as never)
    ? [form.service_type, ...GRIYA_SERVICE_TYPES]
    : [...GRIYA_SERVICE_TYPES]

  async function save() {
    if (!form.visit_date) { setError('Tanggal wajib diisi.'); return }
    setSaving(true); setError(null)
    const { error } = await updateVisit(visit.id, {
      visit_date: form.visit_date,
      visit_time: form.visit_time || null,
      service_type: form.service_type || null,
      attending_staff_id: form.attending_staff_id || null,
      kehadiran: form.kehadiran || null,
      status: form.status,
      notes: form.notes || null,
    })
    setSaving(false)
    if (error) { setError(error); return }
    onSaved()
  }

  async function remove() {
    if (!confirm('Hapus kunjungan ini dari riwayat? Tindakan ini tidak bisa dibatalkan.')) return
    setDeleting(true); setError(null)
    const { error } = await deleteVisit(visit.id)
    setDeleting(false)
    if (error) { setError(error); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-md max-h-[88vh] flex flex-col p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Ubah Kunjungan</h2>
            {visit.patient_name && <p className="text-xs text-muted-foreground mt-0.5">{visit.patient_name}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Tanggal</label>
              <input type="date" value={form.visit_date} onChange={(e) => set('visit_date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Jam</label>
              <input type="time" value={form.visit_time} onChange={(e) => set('visit_time', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Layanan</label>
            <select value={form.service_type} onChange={(e) => set('service_type', e.target.value)} className={inputCls}>
              <option value="">— pilih —</option>
              {serviceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Terapis</label>
            <select value={form.attending_staff_id} onChange={(e) => set('attending_staff_id', e.target.value)} className={inputCls}>
              <option value="">— pilih —</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.nickname || s.full_name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Kehadiran</label>
              <select value={form.kehadiran} onChange={(e) => set('kehadiran', e.target.value)} className={inputCls}>
                <option value="">—</option>
                <option value="HADIR">HADIR</option>
                <option value="TIDAK HADIR">TIDAK HADIR</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value as VisitStatus)} className={inputCls}>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Catatan</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className={`${inputCls} resize-none`} />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex items-center gap-2 pt-4">
          <button onClick={remove} disabled={deleting || saving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive/10 disabled:opacity-60 cursor-pointer">
            <Trash2 size={14} /> {deleting ? '...' : 'Hapus'}
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">Batal</button>
          <button onClick={save} disabled={saving || deleting}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
