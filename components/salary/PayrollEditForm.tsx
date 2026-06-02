'use client'

import { X } from 'lucide-react'
import type { PayrollRecord } from './types'
import { MONTHS, formatRupiah, calcNet } from './types'
import { CurrencyInput } from './CurrencyInput'

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

const FIELDS: {
  field: keyof PayrollEditFormState
  label: string
  negative?: boolean
}[] = [
  { field: 'base_salary',         label: 'Gaji Pokok' },
  { field: 'transport_allowance', label: 'Tunjangan Transport' },
  { field: 'meal_allowance',      label: 'Tunjangan Makan' },
  { field: 'other_allowance',     label: 'Tunjangan Lainnya' },
  { field: 'bonus_achievement',   label: 'Bonus Pencapaian' },
  { field: 'deductions',          label: 'Potongan', negative: true },
]

export function PayrollEditForm({ record, form, saving, onChange, onSubmit, onCancel }: Props) {
  const previewNet = calcNet(form)

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
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {FIELDS.map(({ field, label, negative }) => (
            <div key={field}>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                {label}
                {negative && (
                  <span className="ml-1 text-[10px] text-destructive font-normal">(pengurang)</span>
                )}
              </label>
              <CurrencyInput
                value={form[field] as number}
                onChange={v => onChange({ ...form, [field]: v })}
                inputClassName={negative ? 'border-destructive/40 focus:ring-destructive/30' : ''}
              />
            </div>
          ))}
        </div>

        {/* Live net preview */}
        <div className="flex items-center justify-between bg-muted/40 rounded-xl px-4 py-3 border border-border/50">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Preview Total Bersih</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-foreground">{formatRupiah(previewNet)}</p>
          </div>
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
