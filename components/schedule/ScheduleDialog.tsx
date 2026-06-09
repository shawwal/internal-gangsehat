'use client'

import { X, RotateCcw, CheckSquare } from 'lucide-react'
import type { ScheduleForm, StaffOption, BranchOption } from './types'
import { HARI_LIST, SHIFT_LIST, SHIFT_HOURS } from './constants'

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

// Short abbreviations for the chips
const HARI_SHORT: Record<string, string> = {
  SENIN:  'SEN',
  SELASA: 'SEL',
  RABU:   'RAB',
  KAMIS:  'KAM',
  JUMAT:  'JUM',
  SABTU:  'SAB',
  AHAD:   'AHD',
}

export function ScheduleDialog({
  open, editId, form, staffList, branches, saving,
  onChange, onSave, onClose,
}: Props) {
  if (!open) return null

  const isEdit = editId !== null
  const selectedDays = Array.isArray(form.hari) ? form.hari : [form.hari]

  function toggleDay(day: string) {
    if (selectedDays.includes(day)) {
      if (selectedDays.length === 1) return  // keep at least one
      onChange({ hari: selectedDays.filter((d) => d !== day) })
    } else {
      onChange({ hari: [...selectedDays, day] })
    }
  }

  function selectAll() {
    onChange({ hari: [...HARI_LIST] })
  }

  function resetDays() {
    // Reset to the single original day (first in current selection)
    onChange({ hari: [selectedDays[0]] })
  }

  // When shift is changed, also auto-fill the standard hours
  function handleShiftChange(shift: string) {
    const hours = SHIFT_HOURS[shift]
    if (hours) {
      onChange({ shift, jam_mulai: hours.jam_mulai, jam_selesai: hours.jam_selesai })
    } else {
      onChange({ shift })
    }
  }

  const dayCount = selectedDays.length

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
            {isEdit ? 'Edit Jadwal' : 'Tambah Jadwal'}
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

          {/* Hari — chip multi-select */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-foreground">
                Hari
                {dayCount > 1 && (
                  <span className="ml-1.5 text-primary font-normal">({dayCount} dipilih)</span>
                )}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  disabled={dayCount === HARI_LIST.length}
                  className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <CheckSquare size={11} />
                  Pilih Semua
                </button>
                {dayCount > 1 && (
                  <>
                    <span className="text-[10px] text-border">|</span>
                    <button
                      type="button"
                      onClick={resetDays}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <RotateCcw size={11} />
                      Reset
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {HARI_LIST.map((h) => {
                const sel = selectedDays.includes(h)
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => toggleDay(h)}
                    className={[
                      'px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border min-w-[40px] text-center',
                      sel
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                    ].join(' ')}
                  >
                    {HARI_SHORT[h] ?? h.slice(0, 3)}
                  </button>
                )
              })}
            </div>
            {dayCount > 1 && (
              <p className="text-[11px] text-muted-foreground mt-1.5 pl-0.5">
                {isEdit
                  ? <>Akan memperbarui <span className="text-primary font-semibold">{dayCount}</span> jadwal dengan pengaturan yang sama</>
                  : <>Akan membuat <span className="text-primary font-semibold">{dayCount}</span> jadwal sekaligus dengan pengaturan yang sama</>
                }
              </p>
            )}
          </div>

          {/* Shift */}
          <div>
            <label className={labelCls}>Shift</label>
            <div className="flex gap-2">
              {SHIFT_LIST.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleShiftChange(s)}
                  className={[
                    'flex-1 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer border',
                    form.shift === s
                      ? s === 'PAGI'
                        ? 'bg-[color:var(--secondary)]/15 text-secondary border-[color:var(--secondary)]/40'
                        : 'bg-primary/10 text-primary border-primary/30'
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
            disabled={saving || !form.staff_id || selectedDays.length === 0}
            className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {saving
              ? 'Menyimpan...'
              : isEdit
              ? dayCount > 1
                ? `Simpan ${dayCount} Jadwal`
                : 'Simpan Perubahan'
              : dayCount > 1
              ? `Tambah ${dayCount} Jadwal`
              : 'Tambah Jadwal'}
          </button>
        </div>
      </div>
    </div>
  )
}
