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

export function MoveScopeDialog({ slot, dest, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(scope: 'permanent' | 'this_week') {
    setSaving(true); setError(null)
    const { error } = await moveSlot({
      slotId: slot.id,
      therapist_id: dest.therapistId,
      discipline: dest.discipline,
      hari: dest.hari,
      slot_time: dest.hour,
      scope,
      date: scope === 'this_week' ? dest.dateIso : undefined,
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
              → {dest.therapistName} · {HARI_LABEL[dest.hari]} {dest.hour}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        <button
          onClick={() => run('permanent')}
          disabled={saving}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
        >
          Ubah permanen (setiap minggu)
        </button>
        <button
          onClick={() => run('this_week')}
          disabled={saving}
          className="w-full py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-60 cursor-pointer"
        >
          Minggu ini saja
        </button>

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}
