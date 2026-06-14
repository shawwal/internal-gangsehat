'use client'

import { useState } from 'react'
import { Loader2, Pencil, X } from 'lucide-react'

interface BulkEditPatch {
  shift: 'PAGI' | 'SORE'
  jam_mulai: string
  jam_selesai: string
  status: 'AKTIF' | 'OFF'
}

interface Props {
  open: boolean
  count: number
  saving: boolean
  onSave: (patch: BulkEditPatch) => void
  onClose: () => void
}

const DEFAULT: BulkEditPatch = {
  shift: 'PAGI',
  jam_mulai: '09:00',
  jam_selesai: '15:00',
  status: 'AKTIF',
}

export function BulkEditDialog({ open, count, saving, onSave, onClose }: Props) {
  const [form, setForm] = useState<BulkEditPatch>({ ...DEFAULT })

  if (!open) return null

  function patch<K extends keyof BulkEditPatch>(key: K, value: BulkEditPatch[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-card relative w-full max-w-md p-6 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Pencil size={15} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Edit Jadwal Terpilih</h2>
              <p className="text-xs text-muted-foreground">{count} jadwal akan diperbarui</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          {/* Shift */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Shift</label>
            <div className="flex gap-2">
              {(['PAGI', 'SORE'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => patch('shift', s)}
                  className={[
                    'flex-1 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer border',
                    form.shift === s
                      ? 'bg-primary text-white border-primary'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  ].join(' ')}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Jam Mulai</label>
              <input
                type="time"
                value={form.jam_mulai}
                onChange={(e) => patch('jam_mulai', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Jam Selesai</label>
              <input
                type="time"
                value={form.jam_selesai}
                onChange={(e) => patch('jam_selesai', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Keterangan</label>
            <div className="flex gap-2">
              {(['AKTIF', 'OFF'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => patch('status', s)}
                  className={[
                    'flex-1 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer border',
                    form.status === s
                      ? s === 'AKTIF'
                        ? 'bg-[#34C759] text-white border-[#34C759]'
                        : 'bg-[#FF3B30] text-white border-[#FF3B30]'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  ].join(' ')}
                >
                  {s === 'AKTIF' ? 'MASUK' : 'OFF'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}
