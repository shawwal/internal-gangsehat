'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { moveSlot, type GriyaSlot, type GriyaWeek, type Hari } from '@/app/actions/griyaJadwal'
import { HARI_ORDER, HARI_LABEL, GRIYA_HOURS, DISCIPLINE_LABEL } from './constants'
import { therapistColumns } from './resolve'
import { addDays, toIso } from '@/components/jadwal/utils'

interface Props {
  week: GriyaWeek
  weekMonday: Date
  slot: GriyaSlot
  initialHari: Hari
  onClose: () => void
  onSaved: () => void
}

/** Weekly-view move dialog: the week overview has no per-therapist grid to
 *  click a destination cell on (unlike the daily grid), so destination is
 *  picked explicitly here instead. */
export function WeekMoveDialog({ week, weekMonday, slot, initialHari, onClose, onSaved }: Props) {
  const cols = therapistColumns(week.therapists)
  const [hari, setHari] = useState<Hari>(initialHari)
  const [hour, setHour] = useState(slot.slot_time)
  const [therapistId, setTherapistId] = useState(slot.therapist_id)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const therapist = cols.find((c) => c.therapist_id === therapistId)

  async function run(scope: 'permanent' | 'this_week') {
    if (!therapist) { setError('Pilih terapis tujuan.'); return }
    setSaving(true); setError(null)
    const dayIndex = HARI_ORDER.indexOf(hari)
    const dateIso = toIso(addDays(weekMonday, dayIndex))
    const { error } = await moveSlot({
      slotId: slot.id,
      therapist_id: therapist.therapist_id,
      discipline: therapist.discipline,
      hari,
      slot_time: hour,
      scope,
      date: scope === 'this_week' ? dateIso : undefined,
    })
    setSaving(false)
    if (error) { setError(error); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold text-foreground">Pindahkan {slot.patient_name}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Hari</label>
            <select
              value={hari}
              onChange={(e) => setHari(e.target.value as Hari)}
              className="w-full px-2.5 py-2 rounded-xl border border-border bg-background text-sm cursor-pointer"
            >
              {HARI_ORDER.map((h) => <option key={h} value={h}>{HARI_LABEL[h]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Jam</label>
            <select
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-border bg-background text-sm cursor-pointer"
            >
              {GRIYA_HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Terapis</label>
          <select
            value={therapistId}
            onChange={(e) => setTherapistId(e.target.value)}
            className="w-full px-2.5 py-2 rounded-xl border border-border bg-background text-sm cursor-pointer"
          >
            {cols.map((c) => (
              <option key={c.therapist_id} value={c.therapist_id}>
                {c.nickname || c.full_name} — {DISCIPLINE_LABEL[c.discipline]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 pt-1">
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
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}
