'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { deleteOccurrence, type GriyaSlot } from '@/app/actions/griyaJadwal'
import { HARI_LABEL } from './constants'

interface Props {
  slot: GriyaSlot
  /** The recorded visit for this date, if any (none = still a plain "Terjadwal"). */
  visitId: string | null
  dateIso: string
  onClose: () => void
  onSaved: () => void
}

// "Hapus" on a cell that comes from a weekly (master) schedule. Deleting only the
// visit row can't empty the cell — the weekly schedule regenerates it on reload,
// which is what made deleted sessions "come back". So the choice is explicit.
export function DeleteOccurrenceDialog({ slot, visitId, dateIso, onClose, onSaved }: Props) {
  // A schedule that starts on this very date is almost always a booking meant for
  // one day only (the old "hari ini saja" flow created these) — default to removing it.
  const [scope, setScope] = useState<'date' | 'series'>(!visitId || slot.start_date === dateIso ? 'series' : 'date')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dateLabel = new Date(dateIso + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

  async function save() {
    setSaving(true); setError(null)
    const { error } = await deleteOccurrence(slot.id, dateIso, { stopRecurring: scope === 'series' })
    setSaving(false)
    if (error) { setError(error); return }
    onSaved()
  }

  const options = [
    {
      key: 'series' as const,
      title: 'Hapus & hentikan jadwal rutin',
      desc: `Sesi ${dateLabel} dihapus dan jadwal ${HARI_LABEL[slot.hari]} ${slot.slot_time} tidak muncul lagi mulai tanggal ini. Riwayat sebelumnya tetap tersimpan.`,
      disabled: false,
    },
    {
      key: 'date' as const,
      title: 'Hapus data tanggal ini saja',
      desc: 'Catatan kunjungan tanggal ini dihapus, tetapi jadwal rutin tetap ada — sel akan kembali "Terjadwal". Jika anak hanya tidak datang hari ini, gunakan "Batalkan Hari Ini".',
      disabled: !visitId,
    },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Hapus Jadwal</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {slot.patient_name} · {HARI_LABEL[slot.hari]} {slot.slot_time} (jadwal rutin)
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        <div className="space-y-2">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              disabled={o.disabled}
              onClick={() => setScope(o.key)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                scope === o.key ? 'bg-primary/10 border-primary/40' : 'border-border hover:bg-muted'
              }`}
            >
              <span className={`block text-sm font-medium ${scope === o.key ? 'text-primary' : 'text-foreground'}`}>{o.title}</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">{o.desc}</span>
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">Batal</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 disabled:opacity-60 cursor-pointer">
            {saving ? 'Menghapus...' : 'Hapus'}
          </button>
        </div>
      </div>
    </div>
  )
}
