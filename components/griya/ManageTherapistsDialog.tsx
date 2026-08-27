'use client'

import { useEffect, useState } from 'react'
import { X, Trash2, Plus } from 'lucide-react'
import {
  fetchGriyaTherapistCandidates, upsertGriyaTherapist, removeGriyaTherapist,
  type GriyaTherapist, type BranchStaffOption, type Discipline,
} from '@/app/actions/griyaJadwal'
import { DISCIPLINES, DISCIPLINE_LABEL } from './constants'

interface Props {
  branchId: string
  therapists: GriyaTherapist[]
  onClose: () => void
  onSaved: () => void
}

export function ManageTherapistsDialog({ branchId, therapists, onClose, onSaved }: Props) {
  const [candidates, setCandidates] = useState<BranchStaffOption[]>([])
  const [addId, setAddId] = useState('')
  const [addDisc, setAddDisc] = useState<Discipline>('FISIOTERAPI')
  const [busy, setBusy] = useState(false)

  useEffect(() => { fetchGriyaTherapistCandidates(branchId).then(setCandidates) }, [branchId])

  const usedIds = new Set(therapists.map((t) => t.therapist_id))
  const available = candidates.filter((c) => !usedIds.has(c.id))

  async function add() {
    if (!addId) return
    setBusy(true)
    const maxOrder = Math.max(0, ...therapists.map((t) => t.display_order))
    await upsertGriyaTherapist({ branch_id: branchId, therapist_id: addId, discipline: addDisc, display_order: maxOrder + 10 })
    setBusy(false); setAddId(''); onSaved()
  }

  async function patch(t: GriyaTherapist, changes: Partial<GriyaTherapist>) {
    setBusy(true)
    await upsertGriyaTherapist({
      id: t.id, branch_id: branchId, therapist_id: t.therapist_id,
      discipline: changes.discipline ?? t.discipline,
      display_order: changes.display_order ?? t.display_order,
      is_active: changes.is_active ?? t.is_active,
    })
    setBusy(false); onSaved()
  }

  async function remove(id: string) {
    setBusy(true)
    await removeGriyaTherapist(id)
    setBusy(false); onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border/30">
          <h2 className="text-base font-semibold text-foreground">Kelola Kolom Terapis</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {[...therapists].sort((a, b) => a.display_order - b.display_order).map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-foreground truncate">{t.nickname || t.full_name}</span>
              <select value={t.discipline} onChange={(e) => patch(t, { discipline: e.target.value as Discipline })}
                className="px-2 py-1.5 border border-border rounded-lg text-xs bg-input">
                {DISCIPLINES.map((d) => <option key={d} value={d}>{DISCIPLINE_LABEL[d]}</option>)}
              </select>
              <input type="number" value={t.display_order} onChange={(e) => patch(t, { display_order: Number(e.target.value) })}
                className="w-16 px-2 py-1.5 border border-border rounded-lg text-xs bg-input" />
              <button onClick={() => remove(t.id)} disabled={busy} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive cursor-pointer">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="p-5 border-t border-border/30 flex items-center gap-2">
          <select value={addId} onChange={(e) => setAddId(e.target.value)}
            className="flex-1 px-3 py-2 border border-border rounded-xl text-sm bg-input">
            <option value="">Pilih staff...</option>
            {available.map((c) => <option key={c.id} value={c.id}>{c.nickname || c.full_name}</option>)}
          </select>
          <select value={addDisc} onChange={(e) => setAddDisc(e.target.value as Discipline)}
            className="px-2 py-2 border border-border rounded-xl text-sm bg-input">
            {DISCIPLINES.map((d) => <option key={d} value={d}>{DISCIPLINE_LABEL[d]}</option>)}
          </select>
          <button onClick={add} disabled={busy || !addId}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
            <Plus size={14} /> Tambah
          </button>
        </div>
      </div>
    </div>
  )
}
