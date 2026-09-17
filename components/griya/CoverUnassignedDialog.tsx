'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { moveSlot, type GriyaSlot, type GriyaTherapist } from '@/app/actions/griyaJadwal'
import { HARI_LABEL, DISCIPLINE_LABEL } from './constants'

interface Props {
  slot: GriyaSlot
  dateIso: string
  therapists: GriyaTherapist[]
  onClose: () => void
  onSaved: () => void
}

// Nobody of the slot's discipline is on duty per their rolling schedule today —
// let the admin pick anyone active in that discipline to cover just this date.
// The master schedule (griya_schedule_slots) is never touched.
export function CoverUnassignedDialog({ slot, dateIso, therapists, onClose, onSaved }: Props) {
  const candidates = therapists.filter((t) => t.discipline === slot.discipline && t.is_active)
  const [therapistId, setTherapistId] = useState(candidates[0]?.therapist_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!therapistId) { setError('Pilih terapis.'); return }
    setSaving(true); setError(null)
    const { error } = await moveSlot({ slotId: slot.id, therapist_id: therapistId, slot_time: slot.slot_time, date: dateIso })
    setSaving(false)
    if (error) { setError(error); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Isi Terapis untuk {slot.patient_name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {DISCIPLINE_LABEL[slot.discipline]} · {HARI_LABEL[slot.hari]} {slot.slot_time} — hari ini saja
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada terapis {DISCIPLINE_LABEL[slot.discipline]} aktif di cabang ini.</p>
        ) : (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Terapis</label>
            <select value={therapistId} onChange={(e) => setTherapistId(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary">
              {candidates.map((c) => <option key={c.therapist_id} value={c.therapist_id}>{c.nickname || c.full_name}</option>)}
            </select>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-60 cursor-pointer">
            Batal
          </button>
          <button onClick={run} disabled={saving || candidates.length === 0}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
