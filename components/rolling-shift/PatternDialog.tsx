'use client'

import { X } from 'lucide-react'
import type { ShiftValue } from '@/lib/shift/rollingShift'
import { DAY_KEYS, DAY_LABELS, type PatternFormState } from './types'

interface Props {
  open: boolean
  form: PatternFormState
  saving: boolean
  isEdit: boolean
  onChange: (patch: Partial<PatternFormState>) => void
  onSave: () => void
  onClose: () => void
}

const SHIFT_OPTIONS: ShiftValue[] = ['PAGI', 'SORE', 'OFF']

const SHIFT_STYLE: Record<ShiftValue, string> = {
  PAGI: 'bg-[color:var(--secondary)] text-white border-[color:var(--secondary)]',
  SORE: 'bg-primary text-white border-primary',
  OFF:  'bg-muted text-muted-foreground border-border',
}

export function PatternDialog({ open, form, saving, isEdit, onChange, onSave, onClose }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">{isEdit ? 'Edit Pola' : 'Tambah Pola'} {form.code}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Nama (opsional)</label>
            <input
              value={form.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder={`Pola ${form.code}`}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Shift Senin–Sabtu <span className="text-muted-foreground font-normal">(Minggu dihitung otomatis)</span>
            </label>
            <div className="space-y-2">
              {DAY_KEYS.map((day) => (
                <div key={day} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground w-16 shrink-0">{DAY_LABELS[day]}</span>
                  <div className="flex gap-1.5 flex-1">
                    {SHIFT_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => onChange({ [day]: s } as Partial<PatternFormState>)}
                        className={[
                          'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border',
                          form[day] === s ? SHIFT_STYLE[s] : 'border-border text-muted-foreground hover:bg-muted',
                        ].join(' ')}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-border text-sm hover:bg-muted cursor-pointer">
            Batal
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
