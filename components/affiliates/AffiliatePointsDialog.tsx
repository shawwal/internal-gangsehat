'use client'

import { useCallback, useEffect, useState } from 'react'
import { Ban, Loader2, Pencil, Plus, RotateCcw, Star, X } from 'lucide-react'
import {
  addAffiliateAdjustment,
  fetchAffiliatePoints,
  setAffiliatePointVoid,
  updateAffiliatePointEntry,
  type AffiliatePointEntry,
  type AffiliateRow,
} from '@/app/actions/affiliates'
import { formatDateTime } from '@/components/patient-registrations/types'

interface Props {
  affiliate: AffiliateRow
  onClose: () => void
  /** Called after any change so the list totals refresh. */
  onChanged: () => void
}

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
const inputCls = 'px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40'

function EntryRow({ entry, onChanged }: { entry: AffiliatePointEntry; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [points, setPoints]   = useState(String(entry.points))
  const [note, setNote]       = useState(entry.note ?? '')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function run(fn: () => Promise<{ error: string | null }>) {
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (res.error) { setError(res.error); return false }
    await onChanged()
    return true
  }

  async function save() {
    const ok = await run(() => updateAffiliatePointEntry(entry.id, Number(points), note))
    if (ok) setEditing(false)
  }

  const isReferral = entry.kind === 'referral'
  const changed = isReferral && entry.defaultPoints != null && entry.points !== entry.defaultPoints

  return (
    <div className={`rounded-xl border border-border/60 px-3 py-2.5 space-y-1.5 ${entry.isVoid ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-sm font-medium text-foreground ${entry.isVoid ? 'line-through' : ''}`}>
            {isReferral ? (entry.patientName ?? 'Pasien terhapus') : 'Penyesuaian'}
            {isReferral && entry.patientNoRm && (
              <span className="ml-1.5 font-mono text-xs text-muted-foreground">{entry.patientNoRm}</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(entry.createdAt)}
            {isReferral && entry.transactionAmount != null && ` · bayar ${rupiah(entry.transactionAmount)}`}
            {!isReferral && entry.createdByName && ` · oleh ${entry.createdByName}`}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-sm font-bold tabular-nums ${entry.points < 0 ? 'text-destructive' : 'text-primary'}`}>
            {entry.points > 0 ? '+' : ''}{entry.points}
          </span>
          {!editing && (
            <>
              <button
                onClick={() => setEditing(true)}
                disabled={busy || entry.isVoid}
                title="Ubah poin"
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => run(() => setAffiliatePointVoid(entry.id, !entry.isVoid))}
                disabled={busy}
                title={entry.isVoid ? 'Pulihkan' : 'Batalkan poin'}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                {entry.isVoid ? <RotateCcw size={13} /> : <Ban size={13} />}
              </button>
            </>
          )}
        </div>
      </div>

      {!editing && (entry.note || changed || entry.isVoid) && (
        <p className="text-xs text-muted-foreground">
          {entry.isVoid && <span className="font-medium text-destructive">Dibatalkan. </span>}
          {changed && <span>Awal {entry.defaultPoints} poin. </span>}
          {entry.note}
          {entry.editedByName && entry.editedAt && ` — ${entry.editedByName}, ${formatDateTime(entry.editedAt)}`}
        </p>
      )}

      {editing && (
        <div className="flex flex-wrap gap-2 pt-1">
          <input
            type="number"
            step={1}
            value={points}
            onChange={e => setPoints(e.target.value)}
            className={`${inputCls} w-24`}
          />
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Catatan (wajib jika poin diubah)"
            className={`${inputCls} flex-1 min-w-40`}
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setEditing(false); setPoints(String(entry.points)); setNote(entry.note ?? ''); setError(null) }}
              disabled={busy}
              className="px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
            >
              Batal
            </button>
            <button
              onClick={save}
              disabled={busy || points.trim() === ''}
              className="px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {busy ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function AffiliatePointsDialog({ affiliate, onClose, onChanged }: Props) {
  const [entries, setEntries] = useState<AffiliatePointEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [adjPoints, setAdjPoints] = useState('')
  const [adjNote, setAdjNote]     = useState('')
  const [adding, setAdding]       = useState(false)

  const load = useCallback(async () => {
    const res = await fetchAffiliatePoints(affiliate.id)
    setLoading(false)
    if (res.error) { setError(res.error); return }
    setEntries(res.entries)
  }, [affiliate.id])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function refresh() {
    await load()
    onChanged()
  }

  async function addAdjustment() {
    setAdding(true)
    setError(null)
    const res = await addAffiliateAdjustment(affiliate.id, Number(adjPoints), adjNote)
    setAdding(false)
    if (res.error) { setError(res.error); return }
    setAdjPoints('')
    setAdjNote('')
    await refresh()
  }

  const total = entries.filter(e => !e.isVoid).reduce((sum, e) => sum + e.points, 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-border/60">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Star size={16} className="text-primary" /> Poin {affiliate.name || affiliate.code}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-mono">{affiliate.code}</span> · total <span className="font-semibold text-foreground">{total} poin</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Belum ada poin. Poin otomatis masuk saat pembayaran pertama pasien rujukan dikonfirmasi.
            </p>
          ) : (
            entries.map(e => <EntryRow key={e.id} entry={e} onChanged={refresh} />)
          )}
        </div>

        <div className="px-5 py-4 border-t border-border/60 space-y-2">
          <p className="text-xs font-medium text-foreground">Tambah penyesuaian</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="number"
              step={1}
              value={adjPoints}
              onChange={e => setAdjPoints(e.target.value)}
              placeholder="±Poin"
              className={`${inputCls} w-24`}
            />
            <input
              value={adjNote}
              onChange={e => setAdjNote(e.target.value)}
              placeholder="Catatan (mis. bonus, koreksi, penukaran)"
              className={`${inputCls} flex-1 min-w-40`}
            />
            <button
              onClick={addAdjustment}
              disabled={adding || !adjPoints.trim() || !adjNote.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              <Plus size={14} /> {adding ? 'Menyimpan...' : 'Tambah'}
            </button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  )
}
