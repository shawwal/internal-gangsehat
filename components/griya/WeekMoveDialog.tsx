'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { moveSlot, moveVisit, updateMasterSlot, type GriyaWeek, type Hari } from '@/app/actions/griyaJadwal'
import { HARI_ORDER, HARI_LABEL, GRIYA_HOURS, DISCIPLINE_LABEL } from './constants'
import { therapistColumns } from './resolve'
import { addDays, toIso } from '@/components/jadwal/utils'
import type { MoveTarget } from './MoveScopeDialog'

interface Props {
  week: GriyaWeek
  weekMonday: Date
  target: MoveTarget
  initialHari: Hari
  onClose: () => void
  onSaved: () => void
}

/** Weekly-view move dialog: the week overview has no per-therapist grid to
 *  click a destination cell on (unlike the daily grid), so destination is
 *  picked explicitly here instead. A "slot" target moves one occurrence of a
 *  recurring booking (or, with scope "permanent", the master row itself); a
 *  "visit" target moves an ad-hoc/substitute visit, which has no master row
 *  and no day of its own to change — only its therapist/hour, same day. */
export function WeekMoveDialog({ week, weekMonday, target, initialHari, onClose, onSaved }: Props) {
  const cols = therapistColumns(week.therapists)
  const [hari, setHari] = useState<Hari>(initialHari)
  const [hour, setHour] = useState(target.kind === 'slot' ? target.slot.slot_time : GRIYA_HOURS[0])
  const [therapistId, setTherapistId] = useState(target.kind === 'slot' ? (target.slot.therapist_id ?? '') : '')
  const [scope, setScope] = useState<'once' | 'permanent'>('once')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const therapist = cols.find((c) => c.therapist_id === therapistId)
  const patientName = target.kind === 'slot' ? target.slot.patient_name : target.patientName

  async function run() {
    if (!therapist) { setError('Pilih terapis tujuan.'); return }
    setSaving(true); setError(null)
    const dayIndex = HARI_ORDER.indexOf(hari)
    const dateIso = toIso(addDays(weekMonday, dayIndex))
    const { error } = target.kind === 'visit'
      ? await moveVisit({ visitId: target.visitId, therapist_id: therapist.therapist_id, slot_time: hour })
      : scope === 'once'
        ? await moveSlot({ slotId: target.slot.id, therapist_id: therapist.therapist_id, slot_time: hour, date: dateIso })
        : await updateMasterSlot({
            slotId: target.slot.id,
            hari,
            slot_time: hour,
            discipline: therapist.discipline,
            service_type: target.slot.service_type,
            package_id: target.slot.package_id,
            therapist_id: therapist.therapist_id,
          })
    setSaving(false)
    if (error) { setError(error); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold text-foreground">Pindahkan {patientName}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Hari</label>
            <select
              value={hari}
              disabled={target.kind === 'visit'}
              onChange={(e) => setHari(e.target.value as Hari)}
              className="w-full px-2.5 py-2 rounded-xl border border-border bg-background text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
            <option value="">— pilih —</option>
            {cols.map((c) => (
              <option key={c.therapist_id} value={c.therapist_id}>
                {c.nickname || c.full_name} — {DISCIPLINE_LABEL[c.discipline]}
              </option>
            ))}
          </select>
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
                ? `Hanya untuk tanggal ${HARI_LABEL[hari]} ini — Jadwal Master tidak berubah.`
                : 'Mengubah Jadwal Master secara permanen — terapis dan jam ini akan berlaku setiap minggu mulai sekarang.'}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Kunjungan pengganti ini hanya bisa dipindah jam/terapisnya pada tanggal yang sama.
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-60 cursor-pointer">
            Batal
          </button>
          <button
            onClick={run}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
          >
            {saving ? 'Menyimpan...' : 'Pindahkan'}
          </button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}
