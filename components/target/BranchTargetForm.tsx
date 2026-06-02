'use client'

import { X } from 'lucide-react'
import type { BranchTargetRow, BranchOption } from './types'
import { MONTHS } from './types'

export interface BranchTargetFormState {
  branchId: string
  bulan: number
  tahun: number
  target_ta: number
  target_paket_klinik: number
  target_kunjungan: number
  target_visit: number
  notes: string
}

interface Props {
  editTarget: BranchTargetRow | null
  form: BranchTargetFormState
  saving: boolean
  branches: BranchOption[]
  isManager: boolean
  onChange: (form: BranchTargetFormState) => void
  onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => void
  onCancel: () => void
}

const METRICS: { field: keyof BranchTargetFormState; label: string }[] = [
  { field: 'target_ta', label: 'Target TA (Terapi Awal)' },
  { field: 'target_paket_klinik', label: 'Target Paket Klinik' },
  { field: 'target_kunjungan', label: 'Target Kunjungan' },
  { field: 'target_visit', label: 'Target Visit' },
]

export function BranchTargetForm({
  editTarget,
  form,
  saving,
  branches,
  isManager,
  onChange,
  onSubmit,
  onCancel,
}: Props) {
  function numInput(field: keyof BranchTargetFormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/^0+(?=\d)/, '')
      onChange({ ...form, [field]: Math.max(0, parseInt(raw) || 0) })
    }
  }

  function selectAll(e: React.FocusEvent<HTMLInputElement>) {
    e.target.select()
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {editTarget ? 'Edit Target Cabang' : 'Target Cabang Baru'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {editTarget
              ? `Revisi target ${MONTHS[editTarget.bulan - 1]} ${editTarget.tahun}`
              : isManager
              ? 'Isi target bulanan cabang lalu kirim untuk disetujui direktur'
              : 'Isi target bulanan untuk cabang yang dipilih'}
          </p>
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
        {/* Branch selector — director only, locked on edit */}
        {!isManager && (
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Cabang</label>
            <select
              value={form.branchId}
              disabled={!!editTarget}
              onChange={e => onChange({ ...form, branchId: e.target.value })}
              required
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">Pilih cabang...</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Month & Year */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Bulan</label>
            <select
              value={form.bulan}
              disabled={!!editTarget}
              onChange={e => onChange({ ...form, bulan: +e.target.value })}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Tahun</label>
            <input
              type="number"
              value={form.tahun}
              disabled={!!editTarget}
              min={2020}
              max={2099}
              onChange={e => onChange({ ...form, tahun: +e.target.value })}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {editTarget && (
          <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-xl">
            Cabang, bulan, dan tahun tidak dapat diubah saat mengedit.
          </p>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3">
          {METRICS.map(({ field, label }) => (
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

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Keterangan
            <span className="ml-1 text-muted-foreground font-normal">(opsional)</span>
          </label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={e => onChange({ ...form, notes: e.target.value })}
            placeholder="Tambahkan keterangan jika perlu..."
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
            disabled={saving || (!isManager && !form.branchId)}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Menyimpan...' : editTarget ? 'Perbarui Target' : 'Kirim Target'}
          </button>
        </div>
      </form>
    </div>
  )
}
