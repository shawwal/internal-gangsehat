'use client'

import { useEffect, useRef } from 'react'
import { ArrowDownAZ, ArrowUpAZ, Search, Calendar, User, Stethoscope, ChevronDown } from 'lucide-react'
import type { BranchOption, StaffOption } from '@/app/actions/medicalRecords'
import { COMPLETENESS_TABS, PERIOD_OPTIONS, SERVICE_TYPE_OPTIONS, type RecordFiltersState } from './types'

interface Props {
  filters: RecordFiltersState
  isTeamView: boolean
  isDirector: boolean
  branches: BranchOption[]
  staff: StaffOption[]
  incompleteCount: number
  onChange: (filters: RecordFiltersState) => void
}

// `appearance-none` strips each <select>'s native chrome — without it, iOS
// Safari keeps its own glossy background + affordance icon layered underneath
// our border/bg classes, which is what showed up as a stray icon "behind" the
// dropdown text. We draw our own chevron below to replace the one this removes.
const selectCls = 'shrink-0 appearance-none px-3 py-2 pr-8 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer'
const activeSelectCls = 'border-primary/50 text-primary bg-primary/5'
const chevronCls = 'absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none'
// Single row on mobile that scrolls sideways instead of wrapping into a ragged,
// hard-to-scan grid (Safari especially renders wrapped selects/inputs unevenly).
// From `sm:` up there's room, so it reverts to a normal wrapping row.
const scrollRowCls = 'flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap'

export function MedicalRecordsFilters({ filters, isTeamView, isDirector, branches, staff, incompleteCount, onChange }: Props) {
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearch(value: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => onChange({ ...filters, search: value }), 400)
  }

  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current) }, [])

  return (
    <div className="space-y-3">
      {/* Completeness tabs */}
      <div className={scrollRowCls}>
        {COMPLETENESS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onChange({ ...filters, completeness: tab.value })}
            className={`relative shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              filters.completeness === tab.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {tab.label}
            {tab.value === 'incomplete' && incompleteCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {incompleteCount > 9 ? '9+' : incompleteCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search — its own full-width row so it's never squeezed by the filters below */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Cari nama pasien..."
          defaultValue={filters.search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Filter chips — service type leads, since it's the one staff reach for most */}
      <div className={scrollRowCls}>
        <div className="relative shrink-0">
          <Stethoscope size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${filters.serviceType !== 'all' ? 'text-primary' : 'text-muted-foreground'}`} />
          <select
            value={filters.serviceType}
            onChange={(e) => onChange({ ...filters, serviceType: e.target.value })}
            title="Filter berdasarkan jenis layanan"
            className={`${selectCls} pl-7 ${filters.serviceType !== 'all' ? activeSelectCls : ''}`}
          >
            {SERVICE_TYPE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <ChevronDown size={13} className={chevronCls} />
        </div>

        {isTeamView && isDirector && (
          <div className="relative shrink-0">
            <select
              value={filters.branchId}
              onChange={(e) => onChange({ ...filters, branchId: e.target.value })}
              className={`${selectCls} ${filters.branchId !== 'all' ? activeSelectCls : ''}`}
            >
              <option value="all">Semua Cabang</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <ChevronDown size={13} className={chevronCls} />
          </div>
        )}

        {isTeamView && (
          <div className="relative shrink-0">
            <select
              value={filters.staffId}
              onChange={(e) => onChange({ ...filters, staffId: e.target.value })}
              className={`${selectCls} ${filters.staffId !== 'all' ? activeSelectCls : ''}`}
            >
              <option value="all">Semua Terapis</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <ChevronDown size={13} className={chevronCls} />
          </div>
        )}

        <div className="relative shrink-0">
          <select
            value={filters.period}
            disabled={!!filters.date}
            onChange={(e) => onChange({ ...filters, period: e.target.value as RecordFiltersState['period'] })}
            className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {PERIOD_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <ChevronDown size={13} className={`${chevronCls} ${filters.date ? 'opacity-50' : ''}`} />
        </div>

        {/* Native <input type="date"> renders with no visible text when empty
            (most visibly on iOS Safari — no "dd/mm/yyyy" ghost text like desktop
            Chrome), which reads as a broken, blank box. Overlay our own label
            in that state; it's pointer-events-none so taps still reach the
            input underneath and open the native picker. */}
        <div className="relative shrink-0 flex items-center">
          <input
            type="date"
            value={filters.date}
            onChange={(e) => onChange({ ...filters, date: e.target.value })}
            title="Pilih tanggal kunjungan spesifik"
            className={`${selectCls} w-[132px] pr-7 ${filters.date ? activeSelectCls : 'text-transparent'}`}
          />
          {!filters.date && (
            <span className="absolute left-3 flex items-center gap-1.5 text-sm text-muted-foreground pointer-events-none">
              <Calendar size={13} /> Tanggal
            </span>
          )}
          {filters.date && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, date: '' })}
              title="Hapus filter tanggal"
              className="absolute right-1.5 w-5 h-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted text-xs leading-none cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onChange({ ...filters, sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
          title={filters.sortOrder === 'asc' ? 'Terlama lebih dulu' : 'Terbaru lebih dulu'}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          {filters.sortOrder === 'asc' ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
          {filters.sortOrder === 'asc' ? 'Terlama' : 'Terbaru'}
        </button>

        {/* Group/sort by patient — clusters a patient's incomplete entries
            together instead of interleaving them by date, so nothing gets
            missed and their last program is easy to find. */}
        <div className="shrink-0 flex items-center gap-1 p-0.5 rounded-xl bg-muted border border-border">
          <button
            type="button"
            onClick={() => onChange({ ...filters, groupBy: 'date' })}
            title="Urutkan berdasarkan tanggal kunjungan"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-xs font-semibold transition-all cursor-pointer ${
              filters.groupBy === 'date' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Calendar size={12} /> Tanggal
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...filters, groupBy: 'patient' })}
            title="Kelompokkan berdasarkan pasien"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-xs font-semibold transition-all cursor-pointer ${
              filters.groupBy === 'patient' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <User size={12} /> Pasien
          </button>
        </div>
      </div>
    </div>
  )
}
