'use client'

import { X } from 'lucide-react'
import type { PayrollRecord } from './types'
import { MONTHS, formatRupiah, calcNet } from './types'

export interface PayrollEditFormState {
  base_salary: number
  transport_allowance: number
  meal_allowance: number
  other_allowance: number
  bonus_achievement: number
  deductions: number
  notes: string
}

interface Props {
  record: PayrollRecord | null   // null = creating; non-null = editing
  form: PayrollEditFormState
  saving: boolean
  onChange: (form: PayrollEditFormState) => void
  onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => void
  onCancel: () => void
}

const FIELDS: { field: keyof PayrollEditFormState; label: string; negative?: boolean }[] = [
  { field: 'base_salary',         label: 'Gaji Pokok' },
  { field: 'transport_allowance', label: 'Tunjangan Transport' },
  { field: 'meal_allowance',      label: 'Tunjangan Makan' },
  { field: 'other_allowance',     label: 'Tunjangan Lainnya' },
  { field: 'bonus_achievement',   label: 'Bonus Pencapaian' },
  { field: 'deductions',          label: 'Potongan', negative: true },
]

export function PayrollEditForm({ record, form, saving, onChange, onSubmit, onCancel }: Props) {
  function numInput(field: keyof PayrollEditFormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/^0+(?=\d)/, '')
      onChange({ ...form, [field]: Math.max(0, parseInt(raw) || 0) })
    }
  }

  function selectAll(e: React.FocusEvent<HTMLInputElement>) {
    e.target.select()
  }

  const previewNet = calcNet({
    base_salary: form.base_salary,
    transport_allowance: form.transport_allowance,
    meal_allowance: form.meal_allowance,
    other_allowance: form.other_allowance,
    bonus_achievement: form.bonus_achievement,
    deductions: form.deductions,
  })

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {record ? 'Edit Record Penggajian' : 'Record Penggajian Baru'}
          </h2>
          {record && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {record.internal_profiles?.full_name} — {MONTHS[record.period_month - 1]} {record.period_year}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
        >
          <X size={15} />
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map(({ field, label }) => (
            <div key={field}>
              <label className="block text-xs font-medium text-foreground mb-1.5">{label}</label>
              <input
                type="number"
                min={0}
                value={form[field] as number}
                onChange={numInput(field)}
                onFocus={selectAll}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}
        </div>

        {/* Live net preview */}
        <div className="flex items-center justify-between bg-muted/40 rounded-xl px-3 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">Preview Total Bersih</span>
          <span className="text-sm font-bold text-foreground">{formatRupiah(previewNet)}</span>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Keterangan
            <span className="ml-1 text-muted-foreground font-normal">(opsional)</span>
          </label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={e => onChange({ ...form, notes: e.target.value })}
            placeholder="Tambahkan keterangan..."
            className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  )
}
