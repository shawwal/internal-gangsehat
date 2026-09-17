'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { updateMasterSlot, type GriyaSlot, type Discipline, type Hari } from '@/app/actions/griyaJadwal'
import { GRIYA_HOURS, HARI_ORDER, HARI_LABEL, DISCIPLINES, DISCIPLINE_LABEL } from '../constants'

interface Props {
  slot: GriyaSlot
  onClose: () => void
  onSaved: () => void
}

export function EditMasterScheduleDialog({ slot, onClose, onSaved }: Props) {
  const [hari, setHari] = useState<Hari>(slot.hari)
  const [hour, setHour] = useState(slot.slot_time)
  const [discipline, setDiscipline] = useState<Discipline>(slot.discipline)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true); setError(null)
    const { error } = await updateMasterSlot({
      slotId: slot.id, hari, slot_time: hour, discipline,
      service_type: slot.service_type, package_id: slot.package_id,
    })
    setSaving(false)
    if (error) { setError(error); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold text-foreground">Ubah Jadwal {slot.patient_name}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Hari</label>
            <select value={hari} onChange={(e) => setHari(e.target.value as Hari)}
              className="w-full px-2.5 py-2 border border-border rounded-xl text-sm bg-input">
              {HARI_ORDER.map((h) => <option key={h} value={h}>{HARI_LABEL[h]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Jam</label>
            <select value={hour} onChange={(e) => setHour(e.target.value)}
              className="w-full px-2.5 py-2 border border-border rounded-xl text-sm bg-input">
              {GRIYA_HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Layanan</label>
          <select value={discipline} onChange={(e) => setDiscipline(e.target.value as Discipline)}
            className="w-full px-2.5 py-2 border border-border rounded-xl text-sm bg-input">
            {DISCIPLINES.map((d) => <option key={d} value={d}>{DISCIPLINE_LABEL[d]}</option>)}
          </select>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">Batal</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
