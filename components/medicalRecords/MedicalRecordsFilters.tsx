'use client'

import { useEffect, useRef } from 'react'
import { ArrowDownAZ, ArrowUpAZ, ArrowUpDown, Search, Calendar, Stethoscope, ChevronDown, LayoutGrid, Table2 } from 'lucide-react'
import type { BranchOption, RecordGroupBy, StaffOption } from '@/app/actions/medicalRecords'
import {
  COMPLETENESS_TABS, PERIOD_OPTIONS, SERVICE_TYPE_OPTIONS, SORT_OPTIONS, formatRecordDate,
  type RecordFiltersState, type RecordView,
} from './types'

interface Props {
  filters: RecordFiltersState
  isTeamView: boolean
  isDirector: boolean
  branches: BranchOption[]
  staff: StaffOption[]
  incompleteCount: number
  onChange: (filters: RecordFiltersState) => void
  view: RecordView
  onViewChange: (view: RecordView) => void
}

const VIEW_OPTIONS = [
  { value: 'cards' as const, label: 'Kartu', Icon: LayoutGrid },
  { value: 'table' as const, label: 'Tabel', Icon: Table2 },
]

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

export function MedicalRecordsFilters({
  filters, isTeamView, isDirector, branches, staff, incompleteCount, onChange, view, onViewChange,
}: Props) {
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearch(value: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => onChange({ ...filters, search: value }), 400)
  }

  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current) }, [])

  const inBranch = (s: StaffOption, branchId: string) => branchId === 'all' || s.branch_ids.includes(branchId)
  // Therapists of the chosen branch only. A current pick from elsewhere (e.g.
  // restored from the URL) stays listed so the select never shows blank.
  const branchStaff = staff.filter((s) => inBranch(s, filters.branchId) || s.id === filters.staffId)

  function handleBranch(branchId: string) {
    const picked = staff.find((s) => s.id === filters.staffId)
    const keepStaff = filters.staffId === 'all' || (picked && inBranch(picked, branchId))
    onChange({ ...filters, branchId, ...(keepStaff ? {} : { staffId: 'all' }) })
  }

  // Keeps the range ordered — moving one end past the other drags it along.
  function handleDate(edge: 'dateFrom' | 'dateTo', value: string) {
    const next = { ...filters, [edge]: value }
    if (next.dateFrom && next.dateTo && next.dateFrom > next.dateTo) {
      if (edge === 'dateFrom') next.dateTo = value
      else next.dateFrom = value
    }
    onChange(next)
  }

  const hasRange = !!(filters.dateFrom || filters.dateTo)
  const byName = filters.groupBy !== 'date'

  // Each sort starts in its natural direction: names A–Z, dates newest first.
  function handleSort(groupBy: RecordGroupBy) {
    onChange({ ...filters, groupBy, sortOrder: groupBy === 'date' ? 'desc' : 'asc' })
  }

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
              onChange={(e) => handleBranch(e.target.value)}
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
              {branchStaff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <ChevronDown size={13} className={chevronCls} />
          </div>
        )}

        <div className="relative shrink-0">
          <select
            value={filters.period}
            disabled={hasRange}
            onChange={(e) => onChange({ ...filters, period: e.target.value as RecordFiltersState['period'] })}
            className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {PERIOD_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <ChevronDown size={13} className={`${chevronCls} ${hasRange ? 'opacity-50' : ''}`} />
        </div>

        {/* Date range — either end alone works (open-ended), and any bound
            overrides the period preset. */}
        <div className="shrink-0 flex items-center gap-1.5">
          <DateChip
            label="Dari"
            title="Tanggal kunjungan mulai"
            value={filters.dateFrom}
            max={filters.dateTo || undefined}
            onChange={(v) => handleDate('dateFrom', v)}
          />
          <span className="text-xs text-muted-foreground">–</span>
          <DateChip
            label="Sampai"
            title="Tanggal kunjungan sampai"
            value={filters.dateTo}
            min={filters.dateFrom || undefined}
            onChange={(v) => handleDate('dateTo', v)}
          />
          {hasRange && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, dateFrom: '', dateTo: '' })}
              title="Hapus filter tanggal"
              className="w-6 h-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted text-xs leading-none cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Sort — date, or a name sort that clusters each patient's /
            therapist's entries together so nothing gets missed. */}
        <div className="relative shrink-0">
          <ArrowUpDown size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${filters.groupBy !== 'date' ? 'text-primary' : 'text-muted-foreground'}`} />
          <select
            value={filters.groupBy}
            onChange={(e) => handleSort(e.target.value as RecordGroupBy)}
            title="Urutkan daftar"
            className={`${selectCls} pl-7 ${filters.groupBy !== 'date' ? activeSelectCls : ''}`}
          >
            {SORT_OPTIONS.filter((o) => isTeamView || o.value !== 'therapist' || o.value === filters.groupBy).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown size={13} className={chevronCls} />
        </div>

        <button
          type="button"
          onClick={() => onChange({ ...filters, sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
          title={byName
            ? (filters.sortOrder === 'asc' ? 'Nama A ke Z' : 'Nama Z ke A')
            : (filters.sortOrder === 'asc' ? 'Terlama lebih dulu' : 'Terbaru lebih dulu')}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          {filters.sortOrder === 'asc' ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
          {byName
            ? (filters.sortOrder === 'asc' ? 'A–Z' : 'Z–A')
            : (filters.sortOrder === 'asc' ? 'Terlama' : 'Terbaru')}
        </button>

        <div className="shrink-0 flex items-center gap-1 p-0.5 rounded-xl bg-muted border border-border">
          {VIEW_OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => onViewChange(value)}
              title={value === 'cards' ? 'Tampilan kartu' : 'Tampilan tabel'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-xs font-semibold transition-all cursor-pointer ${
                view === value ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// One end of the date range. The native <input type="date"> is unusable as a
// chip: clicks land on its hidden dd/mm/yyyy segments and only the tiny icon
// opens the calendar (and iOS shows it blank). So the whole chip is a button
// that opens the native picker, and the input stays invisible underneath.
function DateChip({ label, title, value, min, max, onChange }: {
  label: string
  title: string
  value: string
  min?: string
  max?: string
  onChange: (value: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function open() {
    const input = inputRef.current
    if (!input) return
    try {
      input.showPicker()
    } catch {
      // No showPicker (older Safari) — focusing still brings up the picker there.
      input.focus()
      input.click()
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={open}
        title={title}
        className={`${selectCls} pr-3 flex items-center gap-1.5 whitespace-nowrap ${value ? activeSelectCls : 'text-muted-foreground'}`}
      >
        <Calendar size={13} className="shrink-0" />
        {value ? formatRecordDate(value) : label}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none dark:[color-scheme:dark]"
      />
    </div>
  )
}
