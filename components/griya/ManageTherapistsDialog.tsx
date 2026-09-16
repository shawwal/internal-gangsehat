'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Trash2, Plus, GripVertical } from 'lucide-react'
import {
  fetchGriyaTherapistCandidates, upsertGriyaTherapist, removeGriyaTherapist,
  type GriyaTherapist, type BranchStaffOption, type Discipline,
} from '@/app/actions/griyaJadwal'
import { DISCIPLINES, DISCIPLINE_LABEL, DISCIPLINE_COLOR } from './constants'

interface Props {
  branchId: string
  therapists: GriyaTherapist[]
  onClose: () => void
  onSaved: () => void
}

interface LocalRow {
  key: string            // stable local key — real id, or `new-N` before saving
  id?: string             // present once it's a real griya_therapists row
  therapist_id: string
  name: string
  discipline: Discipline
}

type Groups = Record<Discipline, LocalRow[]>

function groupFrom(therapists: GriyaTherapist[]): Groups {
  const g: Groups = { FISIOTERAPI: [], TERAPI_WICARA: [], TERAPI_PERILAKU: [], PSIKOLOG: [] }
  for (const t of [...therapists].sort((a, b) => a.display_order - b.display_order)) {
    g[t.discipline].push({ key: t.id, id: t.id, therapist_id: t.therapist_id, name: t.nickname || t.full_name, discipline: t.discipline })
  }
  return g
}

export function ManageTherapistsDialog({ branchId, therapists, onClose, onSaved }: Props) {
  const [groups, setGroups] = useState<Groups>(() => groupFrom(therapists))
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [candidates, setCandidates] = useState<BranchStaffOption[]>([])
  const [addId, setAddId] = useState('')
  const [addDisc, setAddDisc] = useState<Discipline>('FISIOTERAPI')
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextTempId, setNextTempId] = useState(0)

  useEffect(() => { fetchGriyaTherapistCandidates(branchId).then(setCandidates) }, [branchId])

  const usedIds = useMemo(
    () => new Set(DISCIPLINES.flatMap((d) => groups[d].map((r) => r.therapist_id))),
    [groups],
  )
  const available = candidates.filter((c) => !usedIds.has(c.id))

  function addLocal() {
    const c = candidates.find((x) => x.id === addId)
    if (!c) return
    setGroups((g) => ({
      ...g,
      [addDisc]: [...g[addDisc], { key: `new-${nextTempId}`, therapist_id: c.id, name: c.nickname || c.full_name, discipline: addDisc }],
    }))
    setNextTempId((n) => n + 1)
    setAddId('')
  }

  function removeLocal(disc: Discipline, row: LocalRow) {
    setGroups((g) => ({ ...g, [disc]: g[disc].filter((r) => r.key !== row.key) }))
    if (row.id) setRemovedIds((ids) => [...ids, row.id!])
  }

  function changeDiscipline(disc: Discipline, row: LocalRow, next: Discipline) {
    if (next === disc) return
    setGroups((g) => ({
      ...g,
      [disc]: g[disc].filter((r) => r.key !== row.key),
      [next]: [...g[next], { ...row, discipline: next }],
    }))
  }

  function reorder(disc: Discipline, draggedKey: string, targetKey: string) {
    setGroups((g) => {
      const list = [...g[disc]]
      const from = list.findIndex((r) => r.key === draggedKey)
      const to = list.findIndex((r) => r.key === targetKey)
      if (from === -1 || to === -1 || from === to) return g
      const [moved] = list.splice(from, 1)
      list.splice(to, 0, moved)
      return { ...g, [disc]: list }
    })
  }

  async function save() {
    setSaving(true); setError(null)
    const original = new Map(therapists.map((t) => [t.id, t]))
    const writes: Promise<{ error: string | null }>[] = []

    for (const disc of DISCIPLINES) {
      groups[disc].forEach((row, i) => {
        const display_order = (i + 1) * 10
        const prev = row.id ? original.get(row.id) : undefined
        const changed = !prev || prev.discipline !== row.discipline || prev.display_order !== display_order
        if (changed) {
          writes.push(upsertGriyaTherapist({
            ...(row.id ? { id: row.id } : {}),
            branch_id: branchId,
            therapist_id: row.therapist_id,
            discipline: row.discipline,
            display_order,
          }))
        }
      })
    }
    for (const id of removedIds) writes.push(removeGriyaTherapist(id))

    const results = await Promise.all(writes)
    setSaving(false)
    const firstError = results.find((r) => r.error)?.error
    if (firstError) { setError(firstError); return }
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border/30">
          <div>
            <h2 className="text-base font-semibold text-foreground">Kelola Kolom Terapis</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Seret untuk mengurutkan, ganti kategori bila perlu, lalu simpan.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {DISCIPLINES.map((disc) => {
            const color = DISCIPLINE_COLOR[disc]
            const rows = groups[disc]
            return (
              <div key={disc} className="rounded-2xl border border-border/50 overflow-hidden">
                <div className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 ${color.band}`}>
                  <span className={`w-1.5 h-1.5 rounded-full bg-white/80`} />
                  {DISCIPLINE_LABEL[disc]}
                  <span className="opacity-75 font-normal">· {rows.length}</span>
                </div>
                <div className="p-2 space-y-1 min-h-[44px]" onDragOver={(e) => e.preventDefault()}>
                  {rows.length === 0 && (
                    <p className="px-2 py-2 text-xs text-muted-foreground">Belum ada terapis di kategori ini.</p>
                  )}
                  {rows.map((row) => (
                    <div
                      key={row.key}
                      draggable
                      onDragStart={() => setDragKey(row.key)}
                      onDragEnd={() => { setDragKey(null); setDragOverKey(null) }}
                      onDragOver={(e) => { e.preventDefault(); setDragOverKey(row.key) }}
                      onDrop={(e) => {
                        e.stopPropagation()
                        if (dragKey) reorder(disc, dragKey, row.key)
                        setDragKey(null); setDragOverKey(null)
                      }}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-xl border transition-colors cursor-grab active:cursor-grabbing ${
                        dragOverKey === row.key && dragKey !== row.key ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/50'
                      } ${dragKey === row.key ? 'opacity-40' : ''}`}
                    >
                      <GripVertical size={14} className="text-muted-foreground/60 shrink-0" />
                      <span className="flex-1 text-sm text-foreground truncate">{row.name}</span>
                      <select
                        value={row.discipline}
                        onChange={(e) => changeDiscipline(disc, row, e.target.value as Discipline)}
                        className="px-2 py-1 border border-border rounded-lg text-xs bg-input cursor-pointer"
                      >
                        {DISCIPLINES.map((d) => <option key={d} value={d}>{DISCIPLINE_LABEL[d]}</option>)}
                      </select>
                      <button onClick={() => removeLocal(disc, row)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive cursor-pointer shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="p-5 border-t border-border/30 space-y-3">
          <div className="flex items-center gap-2">
            <select value={addId} onChange={(e) => setAddId(e.target.value)}
              className="flex-1 px-3 py-2 border border-border rounded-xl text-sm bg-input">
              <option value="">Pilih staff...</option>
              {available.map((c) => <option key={c.id} value={c.id}>{c.nickname || c.full_name}</option>)}
            </select>
            <select value={addDisc} onChange={(e) => setAddDisc(e.target.value as Discipline)}
              className="px-2 py-2 border border-border rounded-xl text-sm bg-input">
              {DISCIPLINES.map((d) => <option key={d} value={d}>{DISCIPLINE_LABEL[d]}</option>)}
            </select>
            <button onClick={addLocal} disabled={!addId}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-60 cursor-pointer shrink-0">
              <Plus size={14} /> Tambah
            </button>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} disabled={saving}
              className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-60 cursor-pointer">
              Batal
            </button>
            <button onClick={save} disabled={saving}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
