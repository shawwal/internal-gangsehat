'use client'

import { useEffect, useRef, useState } from 'react'
import { X, RotateCcw, CheckSquare, ChevronDown, Clock, Search, Users } from 'lucide-react'
import type { ScheduleForm, StaffOption, BranchOption } from './types'
import { HARI_LIST, MORNING_SLOTS, AFTERNOON_SLOTS, ALL_SLOTS } from './constants'

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

const HARI_SHORT: Record<string, string> = {
  SENIN:  'SEN',
  SELASA: 'SEL',
  RABU:   'RAB',
  KAMIS:  'KAM',
  JUMAT:  'JUM',
  SABTU:  'SAB',
  AHAD:   'AHD',
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function slotsFromJamMulai(jamMulai: string): string[] {
  const match = ALL_SLOTS.find((s) => s === jamMulai)
  return match ? [match] : []
}

function deriveFromSlots(slots: string[]): { jam_mulai: string; jam_selesai: string; shift: string } {
  const sorted = [...slots].sort()
  return {
    jam_mulai:   sorted[0],
    jam_selesai: addOneHour(sorted[sorted.length - 1]),
    shift:       sorted[0] < '13:00' ? 'PAGI' : 'SORE',
  }
}

// ── Avatar helpers ─────────────────────────────────────────────────────────────

function AvatarCircle({ name, avatarUrl, size }: { name: string; avatarUrl: string | null; size: number }) {
  const [imgError, setImgError] = useState(false)
  const showImg = !!avatarUrl && !imgError
  return (
    <div
      className="rounded-full overflow-hidden shrink-0 flex items-center justify-center text-white font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: showImg ? undefined : 'linear-gradient(135deg, var(--primary), var(--secondary))',
      }}
    >
      {showImg ? (
        <img src={avatarUrl!} alt={name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
      ) : (
        getInitials(name)
      )}
    </div>
  )
}

// ── Multi-select staff checkbox list ──────────────────────────────────────────

interface StaffCheckboxListProps {
  selectedIds: string[]
  options: StaffOption[]
  onChange: (ids: string[]) => void
}

function StaffCheckboxList({ selectedIds, options, onChange }: StaffCheckboxListProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const filtered = query.trim()
    ? options.filter((o) => o.full_name.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0)
  }, [open])

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id],
    )
  }

  function selectAll() { onChange(options.map((o) => o.id)) }
  function clearAll()  { onChange([]) }

  const count = selectedIds.length
  const selectedOptions = options.filter((o) => selectedIds.includes(o.id))

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary flex items-center gap-2 cursor-pointer text-left"
      >
        {count === 0 ? (
          <>
            <Users size={14} className="text-muted-foreground shrink-0" />
            <span className="flex-1 text-muted-foreground">-- Pilih Staff --</span>
          </>
        ) : (
          <>
            {/* Mini avatar stack */}
            <div className="flex -space-x-1.5 shrink-0">
              {selectedOptions.slice(0, 4).map((o) => (
                <AvatarCircle key={o.id} name={o.full_name} avatarUrl={o.avatar_url ?? null} size={22} />
              ))}
              {count > 4 && (
                <div className="w-[22px] h-[22px] rounded-full bg-muted border border-border flex items-center justify-center text-[9px] font-bold text-foreground">
                  +{count - 4}
                </div>
              )}
            </div>
            <span className="flex-1 text-foreground font-medium">{count} staff dipilih</span>
          </>
        )}
        <ChevronDown size={14} className={`text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-[60] mt-1 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search size={13} className="text-muted-foreground shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama..."
              className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Select all / clear bar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/40">
            <span className="text-[10px] text-muted-foreground">{count} dipilih</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                disabled={count === options.length}
                className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 disabled:text-muted-foreground disabled:cursor-not-allowed cursor-pointer"
              >
                <CheckSquare size={11} /> Pilih Semua
              </button>
              {count > 0 && (
                <>
                  <span className="text-[10px] text-border">|</span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <RotateCcw size={11} /> Hapus
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground text-center">
                {query ? `Tidak ada hasil untuk "${query}"` : 'Tidak ada staff untuk cabang ini'}
              </p>
            ) : (
              filtered.map((o) => {
                const checked = selectedIds.includes(o.id)
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(o.id)}
                    className={[
                      'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer text-left',
                      checked ? 'bg-primary/8' : '',
                    ].join(' ')}
                  >
                    {/* Checkbox */}
                    <div className={[
                      'w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all',
                      checked ? 'bg-primary border-primary' : 'border-border',
                    ].join(' ')}>
                      {checked && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <AvatarCircle name={o.full_name} avatarUrl={o.avatar_url ?? null} size={28} />
                    <span className={`truncate ${checked ? 'text-foreground font-medium' : 'text-foreground'}`}>{o.full_name}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Time Slot Accordion ────────────────────────────────────────────────────────

interface TimeSlotAccordionProps {
  selectedSlots: string[]
  onToggle: (slot: string) => void
  onSelectAll: () => void
  onReset: () => void
}

function TimeSlotAccordion({ selectedSlots, onToggle, onSelectAll, onReset }: TimeSlotAccordionProps) {
  const [open, setOpen] = useState(false)
  const count = selectedSlots.length
  const sorted = [...selectedSlots].sort()
  const summary =
    count === 0
      ? 'Pilih Waktu'
      : count === 1
      ? sorted[0]
      : `${sorted[0]} – ${sorted[sorted.length - 1]} (${count} slot)`

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-input hover:bg-muted transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-muted-foreground" />
          <span className={`text-sm ${count === 0 ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
            {summary}
          </span>
        </div>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-3 pt-2.5 pb-3 border-t border-border bg-card space-y-3">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onSelectAll}
              disabled={count === ALL_SLOTS.length}
              className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 disabled:text-muted-foreground disabled:cursor-not-allowed cursor-pointer"
            >
              <CheckSquare size={11} /> Pilih Semua
            </button>
            {count > 0 && (
              <>
                <span className="text-[10px] text-border">|</span>
                <button type="button" onClick={onReset} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer">
                  <RotateCcw size={11} /> Reset
                </button>
              </>
            )}
          </div>

          <div>
            <p className="text-[10px] font-semibold text-[color:var(--secondary)] uppercase tracking-wider mb-1.5">Pagi</p>
            <div className="flex flex-wrap gap-1.5">
              {MORNING_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => onToggle(slot)}
                  className={[
                    'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border',
                    selectedSlots.includes(slot)
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                  ].join(' ')}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1.5">Sore</p>
            <div className="flex flex-wrap gap-1.5">
              {AFTERNOON_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => onToggle(slot)}
                  className={[
                    'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border',
                    selectedSlots.includes(slot)
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                  ].join(' ')}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Dialog ────────────────────────────────────────────────────────────────

export function ScheduleDialog({
  open, editId, form, staffList, branches, saving,
  onChange, onSave, onClose,
}: Props) {
  const [selectedSlots, setSelectedSlots] = useState<string[]>(() =>
    slotsFromJamMulai(form.jam_mulai),
  )

  if (!open) return null

  const isEdit = editId !== null
  const selectedDays = Array.isArray(form.hari) ? form.hari : [form.hari]

  // Strict branch filter — only exact matches; directors (null) only when no branch selected
  const filteredStaff = form.branch_id
    ? staffList.filter((s) => s.branch_id === form.branch_id)
    : staffList

  function toggleDay(day: string) {
    if (selectedDays.includes(day)) {
      if (selectedDays.length === 1) return
      onChange({ hari: selectedDays.filter((d) => d !== day) })
    } else {
      onChange({ hari: [...selectedDays, day] })
    }
  }

  function selectAllDays() { onChange({ hari: [...HARI_LIST] }) }
  function resetDays()     { onChange({ hari: [selectedDays[0]] }) }

  function toggleSlot(slot: string) {
    const next = selectedSlots.includes(slot)
      ? selectedSlots.filter((s) => s !== slot)
      : [...selectedSlots, slot]
    setSelectedSlots(next)
    if (next.length > 0) onChange(deriveFromSlots(next))
  }

  function selectAllSlots() {
    setSelectedSlots(ALL_SLOTS)
    onChange(deriveFromSlots(ALL_SLOTS))
  }

  function resetSlots() { setSelectedSlots([]) }

  const dayCount   = selectedDays.length
  const staffCount = form.staff_ids.length

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
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Branch — first */}
          <div>
            <label className={labelCls}>Cabang</label>
            <select
              value={form.branch_id}
              onChange={(e) => onChange({ branch_id: e.target.value, staff_ids: [] })}
              className={inputCls + ' cursor-pointer'}
            >
              <option value="">-- Pilih Cabang --</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {/* Staff — multi-select checkbox */}
          <div>
            <label className={labelCls}>
              Staff / Terapis <span className="text-[#FF3B30]">*</span>
            </label>
            <StaffCheckboxList
              selectedIds={form.staff_ids}
              options={filteredStaff}
              onChange={(ids) => onChange({ staff_ids: ids })}
            />
            {form.branch_id && filteredStaff.length === 0 && (
              <p className="text-[11px] text-muted-foreground mt-1.5 pl-0.5">
                Tidak ada staff aktif di cabang ini
              </p>
            )}
            {staffCount > 1 && (
              <p className="text-[11px] text-muted-foreground mt-1.5 pl-0.5">
                Jadwal akan diterapkan ke{' '}
                <span className="text-primary font-semibold">{staffCount} staff</span> sekaligus
              </p>
            )}
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
                  onClick={selectAllDays}
                  disabled={dayCount === HARI_LIST.length}
                  className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 disabled:text-muted-foreground disabled:cursor-not-allowed cursor-pointer"
                >
                  <CheckSquare size={11} /> Pilih Semua
                </button>
                {dayCount > 1 && (
                  <>
                    <span className="text-[10px] text-border">|</span>
                    <button type="button" onClick={resetDays} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer">
                      <RotateCcw size={11} /> Reset
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
                  ? <>Akan memperbarui <span className="text-primary font-semibold">{dayCount}</span> hari dengan pengaturan yang sama</>
                  : <>Akan membuat <span className="text-primary font-semibold">{dayCount}</span> jadwal per staff</>
                }
              </p>
            )}
          </div>

          {/* Time slot accordion */}
          <div>
            <label className={labelCls}>Waktu Kerja</label>
            <TimeSlotAccordion
              selectedSlots={selectedSlots}
              onToggle={toggleSlot}
              onSelectAll={selectAllSlots}
              onReset={resetSlots}
            />
            {selectedSlots.length === 0 && (
              <p className="text-[11px] text-muted-foreground mt-1.5 pl-0.5">
                Pilih minimal satu slot waktu
              </p>
            )}
            {selectedSlots.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1.5 pl-0.5">
                Shift: <span className="text-foreground font-medium">{form.shift}</span>
                {' · '}
                {form.jam_mulai} – {form.jam_selesai}
              </p>
            )}
          </div>

          {/* Status toggle */}
          <div>
            <label className={labelCls}>Keterangan</label>
            <div className="flex gap-2">
              {(['AKTIF', 'OFF'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange({ status: s })}
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
            disabled={saving || staffCount === 0 || selectedDays.length === 0 || selectedSlots.length === 0}
            className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {saving
              ? 'Menyimpan...'
              : (() => {
                  const total = staffCount * dayCount
                  if (staffCount > 1 || dayCount > 1)
                    return isEdit
                      ? `Simpan ${total} Jadwal`
                      : `Tambah ${total} Jadwal`
                  return isEdit ? 'Simpan Perubahan' : 'Tambah Jadwal'
                })()}
          </button>
        </div>
      </div>
    </div>
  )
}
