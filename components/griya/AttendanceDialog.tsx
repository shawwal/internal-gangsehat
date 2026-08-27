'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { markAttendance, type AbsenceReason } from '@/app/actions/griyaJadwal'
import { ABSENCE_REASONS } from './constants'
import type { CellTarget } from './types'

interface Props {
  target: CellTarget
  onClose: () => void
  onSaved: () => void
}

export function AttendanceDialog({ target, onClose, onSaved }: Props) {
  const slotId = target.slot?.id
  const [reason, setReason] = useState<AbsenceReason>('SAKIT')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(present: boolean) {
    if (!slotId) return
    setSaving(true); setError(null)
    const { error } = await markAttendance(slotId, target.dateIso, {
      present,
      reason: present ? null : reason,
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
            <h2 className="text-base font-semibold text-foreground">Kehadiran</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {target.slot?.patient_name} · {target.hour} · {target.therapistName}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        <button
          onClick={() => run(true)}
          disabled={saving}
          className="w-full py-2.5 rounded-xl bg-[#34C759] text-white text-sm font-medium hover:bg-[#34C759]/90 disabled:opacity-60 cursor-pointer"
        >
          Tandai Hadir
        </button>

        <div className="space-y-2 pt-2 border-t border-white/10">
          <label className="block text-xs font-medium text-muted-foreground">Alasan tidak hadir</label>
          <div className="grid grid-cols-2 gap-2">
            {ABSENCE_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={`py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                  reason === r ? 'bg-primary/10 text-primary border-primary/40' : 'border-border text-foreground hover:bg-muted'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={() => run(false)}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-[#FF3B30]/15 text-[#FF3B30] border border-[#FF3B30]/40 text-sm font-medium hover:bg-[#FF3B30]/25 disabled:opacity-60 cursor-pointer"
          >
            Tandai Tidak Hadir
          </button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}
