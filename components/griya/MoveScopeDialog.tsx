'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { moveSlot, type GriyaSlot, type Discipline, type Hari } from '@/app/actions/griyaJadwal'
import { HARI_LABEL } from './constants'

export interface MoveDest {
  therapistId: string
  therapistName: string
  discipline: Discipline
  hari: Hari
  hour: string
  dateIso: string
}

interface Props {
  slot: GriyaSlot
  dest: MoveDest
  onClose: () => void
  onSaved: () => void
}

// Reassigning a cell in the Daily/Weekly grid only ever affects that one date —
// the patient's recurring jadwal (Jadwal Master) is never touched from here.
export function MoveScopeDialog({ slot, dest, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setSaving(true); setError(null)
    const { error } = await moveSlot({
      slotId: slot.id,
      therapist_id: dest.therapistId,
      slot_time: dest.hour,
      date: dest.dateIso,
    })
    setSaving(false)
    if (error) { setError(error); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Pindahkan {slot.patient_name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              → {dest.therapistName} · {HARI_LABEL[dest.hari]} {dest.hour} (hari ini saja)
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        <p className="text-xs text-muted-foreground">
          Perubahan ini hanya berlaku untuk tanggal ini. Jadwal tetap anak (Jadwal Master) tidak berubah.
        </p>

        <div className="flex gap-2">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-60 cursor-pointer">
            Batal
          </button>
          <button onClick={run} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
            {saving ? 'Menyimpan...' : 'Pindahkan'}
          </button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}
