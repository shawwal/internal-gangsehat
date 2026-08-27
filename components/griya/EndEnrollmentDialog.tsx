'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { endEnrollment } from '@/app/actions/griyaJadwal'
import { toIso } from './constants'
import type { CellTarget } from './types'

interface Props {
  target: CellTarget
  onClose: () => void
  onSaved: () => void
}

export function EndEnrollmentDialog({ target, onClose, onSaved }: Props) {
  const slotId = target.slot?.id
  const [status, setStatus] = useState<'graduated' | 'stopped'>('graduated')
  const [endDate, setEndDate] = useState(toIso(new Date()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!slotId) return
    setSaving(true); setError(null)
    const { error } = await endEnrollment(slotId, { status, end_date: endDate })
    setSaving(false)
    if (error) { setError(error); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Akhiri Jadwal</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{target.slot?.patient_name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(['graduated', 'stopped'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                status === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground hover:bg-muted'
              }`}
            >
              {s === 'graduated' ? 'Lulus' : 'Stop'}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Tanggal berakhir</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">Batal</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
            {saving ? 'Menyimpan...' : 'Akhiri'}
          </button>
        </div>
      </div>
    </div>
  )
}
