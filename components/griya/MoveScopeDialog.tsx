'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { moveSlot, moveVisit, updateMasterSlot, type GriyaSlot, type Discipline, type Hari } from '@/app/actions/griyaJadwal'
import { HARI_LABEL } from './constants'

export interface MoveDest {
  therapistId: string
  therapistName: string
  discipline: Discipline
  hari: Hari
  hour: string
  dateIso: string
}

export type MoveTarget =
  | { kind: 'slot'; slot: GriyaSlot }
  | { kind: 'visit'; visitId: string; patientName: string }

interface Props {
  target: MoveTarget
  dest: MoveDest
  onClose: () => void
  onSaved: () => void
}

// Reassigning a cell in the Daily/Weekly grid only ever affects that one date —
// the patient's recurring jadwal (Jadwal Master) is never touched from here.
// A "slot" target moves one occurrence of a recurring booking; a "visit" target
// moves an ad-hoc/substitute visit directly (there's no master slot behind it).
export function MoveScopeDialog({ target, dest, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Only a recurring slot has a master row to change permanently — an ad-hoc/
  // substitute visit is inherently one-off, so it only ever moves "for today".
  const [scope, setScope] = useState<'once' | 'permanent'>('once')
  const patientName = target.kind === 'slot' ? target.slot.patient_name : target.patientName

  async function run() {
    setSaving(true); setError(null)
    const { error } = target.kind === 'visit'
      ? await moveVisit({ visitId: target.visitId, therapist_id: dest.therapistId, slot_time: dest.hour })
      : scope === 'once'
        ? await moveSlot({ slotId: target.slot.id, therapist_id: dest.therapistId, slot_time: dest.hour, date: dest.dateIso })
        : await updateMasterSlot({
            slotId: target.slot.id,
            hari: dest.hari,
            slot_time: dest.hour,
            discipline: dest.discipline,
            service_type: target.slot.service_type,
            package_id: target.slot.package_id,
            therapist_id: dest.therapistId,
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
            <h2 className="text-base font-semibold text-foreground">Pindahkan {patientName}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              → {dest.therapistName} · {HARI_LABEL[dest.hari]} {dest.hour}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        {target.kind === 'slot' ? (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Berlaku untuk</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setScope('once')}
                className={`py-2 rounded-xl text-sm font-medium border cursor-pointer ${scope === 'once' ? 'bg-primary/10 text-primary border-primary/40' : 'border-border text-foreground hover:bg-muted'}`}>
                Hari ini saja
              </button>
              <button type="button" onClick={() => setScope('permanent')}
                className={`py-2 rounded-xl text-sm font-medium border cursor-pointer ${scope === 'permanent' ? 'bg-primary/10 text-primary border-primary/40' : 'border-border text-foreground hover:bg-muted'}`}>
                Selamanya
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {scope === 'once'
                ? 'Hanya untuk tanggal ini — jadwal tetap anak (Jadwal Master) tidak berubah.'
                : 'Mengubah Jadwal Master secara permanen — mulai hari ini, terapis ini akan menangani jadwal tetapnya setiap minggu.'}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Perubahan ini hanya berlaku untuk kunjungan pengganti ini saja.
          </p>
        )}

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
