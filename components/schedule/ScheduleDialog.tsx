'use client'

import { X } from 'lucide-react'
import type { ScheduleForm, StaffOption, BranchOption } from './types'
import { HARI_LIST, SHIFT_LIST } from './constants'

interface Props {
  open: boolean
  editId: string | null
  form: ScheduleForm
  staffList: StaffOption[]
  branches: BranchOption[]
  saving: boolean
  onChange: (patch: Partial<ScheduleForm>) => void
  onSave: () => void
  onClose: () => void
}

const inputCls =
  'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
const labelCls = 'block text-xs font-medium text-foreground mb-1.5'

export function ScheduleDialog({
  open, editId, form, staffList, branches, saving,
  onChange, onSave, onClose,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">
            {editId ? 'Edit Jadwal' : 'Tambah Jadwal'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">

          {/* Staff */}
          <div>
            <label className={labelCls}>
              Staff / Terapis <span className="text-[#FF3B30]">*</span>
            </label>
            <select
              value={form.staff_id}
              onChange={(e) => onChange({ staff_id: e.target.value })}
              className={inputCls + ' cursor-pointer'}
            >
              <option value="">-- Pilih Staff --</option>
              {staffList.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>

          {/* Branch */}
          <div>
            <label className={labelCls}>Cabang</label>
            <select
              value={form.branch_id}
              onChange={(e) => onChange({ branch_id: e.target.value })}
              className={inputCls + ' cursor-pointer'}
            >
              <option value="">-- Pilih Cabang --</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {/* Hari + Shift */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Hari</label>
              <select
                value={form.hari}
                onChange={(e) => onChange({ hari: e.target.value })}
                className={inputCls + ' cursor-pointer'}
              >
                {HARI_LIST.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Shift</label>
              <select
                value={form.shift}
                onChange={(e) => onChange({ shift: e.target.value })}
                className={inputCls + ' cursor-pointer'}
              >
                {SHIFT_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Jam Mulai</label>
              <input
                type="time"
                value={form.jam_mulai}
                onChange={(e) => onChange({ jam_mulai: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Jam Selesai</label>
              <input
                type="time"
                value={form.jam_selesai}
                onChange={(e) => onChange({ jam_selesai: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          {/* Status toggle */}
          <div>
            <label className={labelCls}>Status</label>
            <div className="flex gap-2">
              {(['AKTIF', 'OFF'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange({ status: s })}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer border ${
                    form.status === s
                      ? s === 'AKTIF'
                        ? 'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/40'
                        : 'bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/30'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {s === 'AKTIF' ? 'MASUK' : 'OFF'}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>
              Catatan <span className="text-muted-foreground font-normal">(opsional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              rows={2}
              placeholder="Catatan tambahan..."
              className={inputCls + ' resize-none'}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-border text-sm hover:bg-muted transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.staff_id}
            className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {saving ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Tambah Jadwal'}
          </button>
        </div>
      </div>
    </div>
  )
}
