'use client'

import { Users, User, ArrowUpAZ, ArrowDownAZ, Maximize2, Sun, Sunset } from 'lucide-react'
import type { DayStaffEntry } from './types'

interface Props {
  genderFilter: 'all' | 'male' | 'female'
  setGenderFilter: (v: 'all' | 'male' | 'female') => void
  sortOrder: 'asc' | 'desc'
  setSortOrder: (fn: (o: 'asc' | 'desc') => 'asc' | 'desc') => void
  showInactive: boolean
  toggleShowInactive: () => void
  inactiveStaff: DayStaffEntry[]
  baseStaff: DayStaffEntry[]
  visibleStaff: DayStaffEntry[]
  shiftFilter: 'all' | 'pagi' | 'sore'
  setShiftFilter: (v: 'all' | 'pagi' | 'sore') => void
  onFocus: () => void
}

export function ControlsBar({
  genderFilter, setGenderFilter,
  sortOrder, setSortOrder,
  showInactive, toggleShowInactive,
  inactiveStaff, baseStaff, visibleStaff,
  shiftFilter, setShiftFilter,
  onFocus,
}: Props) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Gender filter pills */}
      <div className="flex items-center bg-muted/40 rounded-2xl p-1 gap-0.5">
        {([
          { value: 'all',    label: 'Semua',  icon: <Users size={13} /> },
          { value: 'male',   label: 'Pria',   icon: <User  size={13} /> },
          { value: 'female', label: 'Wanita', icon: <User  size={13} /> },
        ] as const).map(({ value, label, icon }) => (
          <button
            key={value}
            onClick={() => setGenderFilter(value)}
            aria-pressed={genderFilter === value}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer',
              genderFilter === value
                ? value === 'male'
                  ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/30'
                  : value === 'female'
                  ? 'bg-[#FF0090] text-white shadow-sm shadow-primary/30'
                  : 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/10',
            ].join(' ')}
          >
            {icon}
            {label}
            {genderFilter !== value && (
              <span className="text-[10px] opacity-60">
                {value === 'all'
                  ? baseStaff.length
                  : baseStaff.filter((s) => s.gender === value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {genderFilter !== 'all' && (
        <span className="text-xs text-muted-foreground">
          {visibleStaff.length} terapis
        </span>
      )}

      {/* Shift filter pills — hide morning or afternoon to focus scheduling */}
      <div className="flex items-center bg-muted/40 rounded-2xl p-1 gap-0.5">
        {([
          { value: 'all',  label: 'Semua Shift', icon: null },
          { value: 'pagi', label: 'Pagi',         icon: <Sun    size={13} /> },
          { value: 'sore', label: 'Sore',         icon: <Sunset size={13} /> },
        ] as const).map(({ value, label, icon }) => (
          <button
            key={value}
            onClick={() => setShiftFilter(value)}
            aria-pressed={shiftFilter === value}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer',
              shiftFilter === value
                ? 'bg-secondary text-secondary-foreground shadow-sm shadow-secondary/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/10',
            ].join(' ')}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* View controls: sort + inactive toggle + focus */}
      <div className="ml-auto flex items-center gap-0.5 bg-muted/40 rounded-2xl p-1">
        <button
          onClick={() => setSortOrder((o) => o === 'asc' ? 'desc' : 'asc')}
          title={sortOrder === 'asc' ? 'Urutan A→Z' : 'Urutan Z→A'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-150 cursor-pointer"
        >
          {sortOrder === 'asc' ? <ArrowUpAZ size={13} /> : <ArrowDownAZ size={13} />}
          Nama
        </button>

        {inactiveStaff.length > 0 && (
          <>
            <div className="w-px h-4 bg-border/60 mx-0.5" />
            <button
              onClick={toggleShowInactive}
              aria-pressed={showInactive}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-150 cursor-pointer"
            >
              <span className="select-none">Nonaktif ({inactiveStaff.length})</span>
              <span
                className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                  showInactive ? 'bg-primary' : 'bg-muted-foreground/40'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    showInactive ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>
          </>
        )}

        <div className="w-px h-4 bg-border/60 mx-0.5" />
        <button
          onClick={onFocus}
          title="Mode fokus (Esc untuk keluar)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-150 cursor-pointer"
        >
          <Maximize2 size={13} />
          Fokus
        </button>
      </div>
    </div>
  )
}
