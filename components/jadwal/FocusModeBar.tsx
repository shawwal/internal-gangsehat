'use client'

import { useRef } from 'react'
import { Users, User, ArrowUpAZ, ArrowDownAZ, ChevronLeft, ChevronRight, Calendar, Plus, X } from 'lucide-react'
import { addDays, toIso, isSameDay, JS_DAY_TO_HARI, HARI_LABEL, MONTH_FULL } from './utils'
import type { DayStaffEntry } from './types'

interface Branch {
  id: string
  name: string
}

interface Props {
  branches: Branch[]
  selectedBranchId: string | null
  setSelectedBranchId: (id: string | null) => void
  selectedDate: Date
  setSelectedDate: (d: Date) => void
  today: Date
  genderFilter: 'all' | 'male' | 'female'
  setGenderFilter: (v: 'all' | 'male' | 'female') => void
  sortOrder: 'asc' | 'desc'
  setSortOrder: (fn: (o: 'asc' | 'desc') => 'asc' | 'desc') => void
  showInactive: boolean
  toggleShowInactive: () => void
  inactiveStaff: DayStaffEntry[]
  onExit: () => void
  canCreateOrder?: boolean
  orderNewHref?: string
}

export function FocusModeBar({
  branches, selectedBranchId, setSelectedBranchId,
  selectedDate, setSelectedDate, today,
  genderFilter, setGenderFilter,
  sortOrder, setSortOrder,
  showInactive, toggleShowInactive,
  inactiveStaff,
  onExit,
  canCreateOrder,
  orderNewHref,
}: Props) {
  const focusDateInputRef = useRef<HTMLInputElement>(null)
  const isToday   = isSameDay(selectedDate, today)
  const dayLabel  = HARI_LABEL[JS_DAY_TO_HARI[selectedDate.getDay()]]?.slice(0, 3).toUpperCase() ?? ''

  return (
    <div className="j-bar-slide flex items-center gap-2 px-3 py-2 border-b border-white/8 bg-background/98 backdrop-blur-md shrink-0">

      {/* Branch select */}
      {branches.length > 0 && (
        <select
          value={selectedBranchId ?? ''}
          onChange={(e) => setSelectedBranchId(e.target.value || null)}
          className="px-2.5 py-1.5 border border-white/10 rounded-xl text-xs bg-white/5 hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-primary/60 cursor-pointer text-foreground transition-colors duration-150 max-w-[160px] truncate"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      )}

      {/* Compact date nav pill */}
      <div className="flex items-center bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
        <button
          onClick={() => setSelectedDate(addDays(selectedDate, -1))}
          aria-label="Hari sebelumnya"
          className="p-2 hover:bg-white/10 transition-colors duration-150 cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={13} />
        </button>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 select-none">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
            {dayLabel}
          </span>
          <span className={`text-sm font-bold leading-none tabular-nums ${isToday ? 'text-primary' : 'text-foreground'}`}>
            {selectedDate.getDate()}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium">
            {MONTH_FULL[selectedDate.getMonth()].slice(0, 3)}
          </span>
        </div>
        <button
          onClick={() => setSelectedDate(addDays(selectedDate, 1))}
          aria-label="Hari berikutnya"
          className="p-2 hover:bg-white/10 transition-colors duration-150 cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <ChevronRight size={13} />
        </button>
        <div className="w-px h-5 bg-white/10 self-center" />
        <div className="relative">
          <button
            onClick={() => focusDateInputRef.current?.showPicker()}
            title="Pilih tanggal"
            aria-label="Pilih tanggal"
            className="p-2 hover:bg-white/10 transition-colors duration-150 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <Calendar size={13} />
          </button>
          <input
            ref={focusDateInputRef}
            type="date"
            value={toIso(selectedDate)}
            onChange={(e) => { if (e.target.value) setSelectedDate(new Date(e.target.value + 'T00:00:00')) }}
            className="absolute inset-0 opacity-0 w-full h-full pointer-events-none"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
        {!isToday && (
          <button
            onClick={() => setSelectedDate(new Date())}
            aria-label="Kembali ke hari ini"
            className="px-2.5 py-1.5 text-[10px] font-semibold text-primary hover:bg-primary/10 transition-colors duration-150 cursor-pointer border-l border-white/8"
          >
            Hari ini
          </button>
        )}
      </div>

      {canCreateOrder && orderNewHref && (
        <a
          href={orderNewHref}
          target="_blank"
          rel="noopener noreferrer"
          title="Tambah order (tab baru)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-colors duration-150 cursor-pointer shrink-0"
        >
          <Plus size={13} /> Order
        </a>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Gender filter */}
        <div className="flex items-center bg-white/5 border border-white/8 rounded-2xl p-0.5 gap-0.5">
          {([
            { value: 'all',    label: 'Semua', icon: <Users size={12} /> },
            { value: 'male',   label: 'Pria',  icon: <User  size={12} /> },
            { value: 'female', label: 'Wanita',icon: <User  size={12} /> },
          ] as const).map(({ value, label, icon }) => (
            <button
              key={value}
              onClick={() => setGenderFilter(value)}
              aria-pressed={genderFilter === value}
              className={[
                'flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all duration-150 cursor-pointer',
                genderFilter === value
                  ? value === 'male'   ? 'bg-blue-500 text-white shadow-sm'
                  : value === 'female' ? 'bg-primary text-white shadow-sm shadow-primary/30'
                  : 'bg-white/15 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/8',
              ].join(' ')}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {/* Sort + inactive + exit */}
        <div className="flex items-center bg-white/5 border border-white/8 rounded-2xl p-0.5">
          <button
            onClick={() => setSortOrder((o) => o === 'asc' ? 'desc' : 'asc')}
            title={sortOrder === 'asc' ? 'A→Z' : 'Z→A'}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-150 cursor-pointer"
          >
            {sortOrder === 'asc' ? <ArrowUpAZ size={12} /> : <ArrowDownAZ size={12} />}
            Nama
          </button>
          {inactiveStaff.length > 0 && (
            <>
              <div className="w-px h-4 bg-white/10 mx-0.5" />
              <button
                onClick={toggleShowInactive}
                aria-pressed={showInactive}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-150 cursor-pointer"
              >
                <span className="select-none">Nonaktif</span>
                <span className={`relative inline-flex h-3.5 w-6 shrink-0 rounded-full border border-transparent transition-colors duration-200 ${showInactive ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                  <span className={`pointer-events-none inline-block h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${showInactive ? 'translate-x-2.5' : 'translate-x-0'}`} />
                </span>
              </button>
            </>
          )}
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <button
            onClick={onExit}
            title="Ringkas (Esc)"
            aria-label="Ringkas ke tampilan normal"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-150 cursor-pointer"
          >
            <X size={12} />
            Ringkas
          </button>
        </div>
      </div>

    </div>
  )
}
