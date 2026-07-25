'use client'

import { X } from 'lucide-react'
import type { ShiftPattern } from '@/app/actions/rollingShift'
import type { TeamFormState } from './types'

interface Props {
  open: boolean
  form: TeamFormState
  patterns: ShiftPattern[]
  saving: boolean
  isEdit: boolean
  onChange: (patch: Partial<TeamFormState>) => void
  onSave: () => void
  onClose: () => void
}

const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
const labelCls = 'block text-xs font-medium text-foreground mb-1.5'

export function TeamDialog({ open, form, patterns, saving, isEdit, onChange, onSave, onClose }: Props) {
  if (!open) return null

  const canSave = !!form.pola_x_id && !!form.pola_y_id && form.pola_x_id !== form.pola_y_id && !!form.anchor_date

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">{isEdit ? 'Edit Tim' : 'Tambah Tim'} {form.name}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Pola X (aktif di periode ganjil untuk Tim ini)</label>
            <select value={form.pola_x_id} onChange={(e) => onChange({ pola_x_id: e.target.value })} className={inputCls + ' cursor-pointer'}>
              <option value="">-- Pilih Pola --</option>
              {patterns.map((p) => <option key={p.id} value={p.id}>{p.name || `Pola ${p.code}`}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Pola Y (aktif di periode genap untuk Tim ini)</label>
            <select value={form.pola_y_id} onChange={(e) => onChange({ pola_y_id: e.target.value })} className={inputCls + ' cursor-pointer'}>
              <option value="">-- Pilih Pola --</option>
              {patterns.map((p) => <option key={p.id} value={p.id}>{p.name || `Pola ${p.code}`}</option>)}
            </select>
            {form.pola_x_id && form.pola_x_id === form.pola_y_id && (
              <p className="text-[11px] text-destructive mt-1.5">Pola X dan Y harus berbeda</p>
            )}
          </div>

          <div>
            <label className={labelCls}>Tanggal Jangkar (Senin minggu ke-1, periode 1)</label>
            <input
              type="date"
              value={form.anchor_date}
              onChange={(e) => onChange({ anchor_date: e.target.value })}
              className={inputCls}
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Pastikan tanggal ini jatuh pada hari Senin — jadi titik awal perhitungan rotasi 2 mingguan.
            </p>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-border text-sm hover:bg-muted cursor-pointer">
            Batal
          </button>
          <button
            onClick={onSave}
            disabled={saving || !canSave}
            className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
