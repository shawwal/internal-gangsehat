'use client'

import { useEffect, useState } from 'react'
import { Copy, X } from 'lucide-react'
import { fetchGriyaSessionNote, fetchGriyaPertemuanKe, saveGriyaSessionNote, fetchPreviousGriyaSessionNote } from '@/app/actions/griyaSessionNotes'
import type { GriyaSessionNote } from '@/types'

const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary resize-none'
const labelCls = 'block text-xs font-medium text-muted-foreground mb-1'

export interface SessionNoteTarget {
  visitId: string
  patientId: string
  patientName: string
  branchId: string
  griyaSlotId: string | null
}

interface Props {
  target: SessionNoteTarget
  onClose: () => void
  onSaved: () => void
}

type FormState = {
  sudah_diperiksa: boolean
  subjective: string
  objective: string
  assessment: string
  plan: string
  keterangan_periksa: string
}

const EMPTY_FORM: FormState = {
  sudah_diperiksa: false, subjective: '', objective: '', assessment: '', plan: '', keterangan_periksa: '',
}

function toForm(n: GriyaSessionNote | null): FormState {
  if (!n) return EMPTY_FORM
  return {
    sudah_diperiksa: n.sudah_diperiksa,
    subjective: n.subjective ?? '',
    objective: n.objective ?? '',
    assessment: n.assessment ?? '',
    plan: n.plan ?? '',
    keterangan_periksa: n.keterangan_periksa ?? '',
  }
}

export function SessionNoteModal({ target, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true)
  const [pertemuanKe, setPertemuanKe] = useState(1)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchGriyaSessionNote(target.visitId),
      fetchGriyaPertemuanKe(target.visitId, target.patientId, target.griyaSlotId),
    ]).then(([note, ke]) => {
      if (cancelled) return
      setForm(toForm(note))
      setPertemuanKe(ke)
      setLoading(false)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.visitId])

  const [copying, setCopying] = useState(false)
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null)

  async function copyPrevious() {
    const hasContent = form.subjective || form.objective || form.assessment || form.plan || form.keterangan_periksa
    if (hasContent && !confirm('Isi yang sudah ada akan diganti dengan catatan pertemuan sebelumnya. Lanjutkan?')) return
    setCopying(true); setError(null)
    const prev = await fetchPreviousGriyaSessionNote(target.visitId, target.patientId)
    setCopying(false)
    if (!prev) { setError('Belum ada catatan pertemuan sebelumnya untuk disalin.'); return }
    setForm((f) => ({
      ...f,
      subjective: prev.subjective ?? '', objective: prev.objective ?? '', assessment: prev.assessment ?? '',
      plan: prev.plan ?? '', keterangan_periksa: prev.keterangan_periksa ?? '',
    }))
    setCopiedFrom(new Date(prev.visit_date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }))
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const requiredMissing = form.sudah_diperiksa && (
    !form.subjective.trim() || !form.objective.trim() || !form.assessment.trim() ||
    !form.plan.trim() || !form.keterangan_periksa.trim()
  )

  async function save() {
    if (requiredMissing) { setError('Lengkapi semua kolom sebelum menandai sudah diperiksa.'); return }
    setSaving(true); setError(null)
    const { error } = await saveGriyaSessionNote(target.visitId, target.patientId, target.branchId, form)
    setSaving(false)
    if (error) { setError(error); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-md max-h-[88vh] flex flex-col p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Periksa Pertemuan Ke-{pertemuanKe}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{target.patientName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Memuat...</p>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={form.sudah_diperiksa}
                onChange={(e) => set('sudah_diperiksa', e.target.checked)}
                className="h-4 w-4 rounded accent-[#34C759]"
              />
              Sudah diperiksa
            </label>

            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={copyPrevious} disabled={copying}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted disabled:opacity-60 cursor-pointer">
                <Copy size={12} /> {copying ? 'Menyalin...' : 'Salin dari pertemuan sebelumnya'}
              </button>
              {copiedFrom && <span className="text-[11px] text-muted-foreground">Disalin dari {copiedFrom} — sesuaikan sebelum menyimpan</span>}
            </div>

            <div>
              <label className={labelCls}>Subjective *</label>
              <textarea value={form.subjective} onChange={(e) => set('subjective', e.target.value)} rows={2}
                placeholder="Masukkan Subjective" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Objective *</label>
              <textarea value={form.objective} onChange={(e) => set('objective', e.target.value)} rows={2}
                placeholder="Masukkan Objective" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Assessment *</label>
              <textarea value={form.assessment} onChange={(e) => set('assessment', e.target.value)} rows={2}
                placeholder="Masukkan Assessment" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Plan *</label>
              <textarea value={form.plan} onChange={(e) => set('plan', e.target.value)} rows={2}
                placeholder="Masukkan Plan" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Keterangan Periksa *</label>
              <textarea value={form.keterangan_periksa} onChange={(e) => set('keterangan_periksa', e.target.value)} rows={2}
                className={inputCls} />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">Batal</button>
          <button onClick={save} disabled={saving || loading}
            className="px-4 py-2 rounded-xl bg-[#34C759] text-white text-sm font-medium hover:bg-[#34C759]/90 disabled:opacity-60 cursor-pointer">
            {saving ? 'Menyimpan...' : '✓ Update'}
          </button>
        </div>
      </div>
    </div>
  )
}
