'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Info, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type {
  AttendanceCalendarRow,
  CalendarEffectiveStatus,
  CalendarStaffEntry,
  LeaveCalendarRow,
  ScheduleRow,
  StaffOption,
  BranchOption,
} from './types'

// ── Constants ──────────────────────────────────────────────────────────────────
const JS_DAY_TO_HARI = ['AHAD', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'] as const
const HARI_LABEL: Record<string, string> = {
  SENIN: 'Senin', SELASA: 'Selasa', RABU: 'Rabu', KAMIS: 'Kamis',
  JUMAT: 'Jumat', SABTU: 'Sabtu', AHAD: 'Ahad',
}
const MONTH_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

const GRID_START   = 8     // 08:00
const GRID_END     = 20    // 20:00
const SLOT_HEIGHT  = 28    // px per 30-min slot
const TOTAL_SLOTS  = (GRID_END - GRID_START) * 2  // 24 slots
const TOTAL_HEIGHT = TOTAL_SLOTS * SLOT_HEIGHT     // 672px
const COL_W        = 168   // px per staff column

// ── Helpers ────────────────────────────────────────────────────────────────────
function toHariIndonesia(d: Date): string {
  return JS_DAY_TO_HARI[d.getDay()]
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseHour(time: string): number {
  const [h, min] = time.split(':').map(Number)
  return h + (min || 0) / 60
}

function formatDateLabel(d: Date): string {
  const hari = HARI_LABEL[toHariIndonesia(d)] ?? toHariIndonesia(d)
  return `${hari}, ${d.getDate()} ${MONTH_ID[d.getMonth()]} ${d.getFullYear()}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
}

function computeEffectiveStatus(
  schedulesForDay: ScheduleRow[],
  leave: LeaveCalendarRow | null,
  attendance: AttendanceCalendarRow | null,
): CalendarEffectiveStatus {
  if (attendance) {
    const s = attendance.status
    if (s === 'present' || s === 'late') return 'OVERRIDE_AKTIF'
    if (s === 'absent' || s === 'sick')  return 'OVERRIDE_OFF'
    if (s === 'leave')                   return 'CUTI'
  }
  if (leave) return 'CUTI'
  if (schedulesForDay.some((s) => s.status === 'AKTIF')) return 'AKTIF'
  return 'OFF'
}

// ── Status visual config ───────────────────────────────────────────────────────
const STATUS_CFG: Record<CalendarEffectiveStatus, {
  label: string
  blockBg: string
  blockBorder: string
  headerBg: string
  textColor: string
  badgeCls: string
}> = {
  AKTIF: {
    label:       'Masuk',
    blockBg:     'bg-[#34C759]/15',
    blockBorder: 'border-[#34C759]/50',
    headerBg:    'bg-[#34C759]/8',
    textColor:   'text-[#34C759]',
    badgeCls:    'bg-[#34C759]/20 text-[#34C759]',
  },
  OVERRIDE_AKTIF: {
    label:       'Masuk*',
    blockBg:     'bg-[#34C759]/15',
    blockBorder: 'border-[#FF0090]/60',
    headerBg:    'bg-[#34C759]/8',
    textColor:   'text-[#34C759]',
    badgeCls:    'bg-[#FF0090]/20 text-[#FF0090]',
  },
  CUTI: {
    label:       'Cuti',
    blockBg:     'bg-amber-500/15',
    blockBorder: 'border-amber-500/50',
    headerBg:    'bg-amber-500/8',
    textColor:   'text-amber-400',
    badgeCls:    'bg-amber-500/20 text-amber-400',
  },
  OVERRIDE_OFF: {
    label:       'Tdk Hadir*',
    blockBg:     'bg-destructive/10',
    blockBorder: 'border-destructive/40',
    headerBg:    'bg-destructive/8',
    textColor:   'text-destructive',
    badgeCls:    'bg-destructive/20 text-destructive',
  },
  OFF: {
    label:       'OFF',
    blockBg:     'bg-muted/20',
    blockBorder: 'border-border/30',
    headerBg:    'bg-muted/5',
    textColor:   'text-muted-foreground',
    badgeCls:    'bg-muted/30 text-muted-foreground',
  },
}

const STATUS_ORDER: Record<CalendarEffectiveStatus, number> = {
  AKTIF: 0, OVERRIDE_AKTIF: 1, CUTI: 2, OVERRIDE_OFF: 3, OFF: 4,
}

// ── Time slots array ───────────────────────────────────────────────────────────
const TIME_SLOTS: string[] = []
for (let h = GRID_START; h < GRID_END; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`)
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`)
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  staffList: StaffOption[]
  branches: BranchOption[]
}

interface PopoverState {
  entry: CalendarStaffEntry
  top: number
  left: number
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════════════
export function ScheduleCalendarView({ staffList }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [entries, setEntries]           = useState<CalendarStaffEntry[]>([])
  const [loading, setLoading]           = useState(true)
  const [animKey, setAnimKey]           = useState(0)
  const [animDir, setAnimDir]           = useState<'left' | 'right' | ''>('')
  const [popover, setPopover]           = useState<PopoverState | null>(null)
  const [saving, setSaving]             = useState<string | null>(null)
  const gridRef                         = useRef<HTMLDivElement>(null)
  const today                           = new Date()

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadCalendar = useCallback(
    async (date: Date) => {
      setLoading(true)
      const supabase = createClient()
      const isoDate  = toIsoDate(date)
      const hari     = toHariIndonesia(date)

      const [schedulesRes, leavesRes, attendanceRes] = await Promise.all([
        supabase
          .from('schedules')
          .select(
            'id, staff_id, branch_id, hari, shift, jam_mulai, jam_selesai, status, notes, internal_profiles!staff_id(full_name)',
          )
          .eq('hari', hari),
        supabase
          .from('leave_requests')
          .select('id, staff_id, start_date, end_date, reason')
          .eq('status', 'approved')
          .lte('start_date', isoDate)
          .gte('end_date', isoDate),
        supabase.from('attendance').select('id, staff_id, status, notes').eq('date', isoDate),
      ])

      // Index by staff_id
      const schedsByStaff = new Map<string, ScheduleRow[]>()
      for (const row of (schedulesRes.data ?? []) as unknown as ScheduleRow[]) {
        const list = schedsByStaff.get(row.staff_id) ?? []
        list.push(row)
        schedsByStaff.set(row.staff_id, list)
      }

      const leaveByStaff = new Map<string, LeaveCalendarRow>()
      for (const row of leavesRes.data ?? []) {
        leaveByStaff.set(row.staff_id, {
          id: row.id,
          start_date: row.start_date,
          end_date: row.end_date,
          reason: row.reason,
        })
      }

      const attendanceByStaff = new Map<string, AttendanceCalendarRow>()
      for (const row of attendanceRes.data ?? []) {
        attendanceByStaff.set(row.staff_id, { id: row.id, status: row.status, notes: row.notes })
      }

      // Union of all staff with any activity for this date
      const activeStaffIds = new Set([
        ...schedsByStaff.keys(),
        ...leaveByStaff.keys(),
        ...attendanceByStaff.keys(),
      ])

      // Build entries
      const result: CalendarStaffEntry[] = []
      for (const staffId of activeStaffIds) {
        const profile        = staffList.find((s) => s.id === staffId)
        const schedulesForDay = schedsByStaff.get(staffId) ?? []
        const leave          = leaveByStaff.get(staffId) ?? null
        const attendance     = attendanceByStaff.get(staffId) ?? null
        const branchId       = schedulesForDay[0]?.branch_id ?? profile?.branch_id ?? null

        result.push({
          staff_id:         staffId,
          full_name:        profile?.full_name ?? 'Unknown',
          branch_id:        branchId,
          schedules_for_day: schedulesForDay,
          leave,
          attendance,
          effectiveStatus:  computeEffectiveStatus(schedulesForDay, leave, attendance),
        })
      }

      result.sort((a, b) => {
        const diff = STATUS_ORDER[a.effectiveStatus] - STATUS_ORDER[b.effectiveStatus]
        return diff !== 0 ? diff : a.full_name.localeCompare(b.full_name)
      })

      setEntries(result)
      setLoading(false)
    },
    [staffList],
  )

  useEffect(() => {
    loadCalendar(selectedDate)
  }, [selectedDate, loadCalendar])

  // ── Navigation ─────────────────────────────────────────────────────────────
  function navigate(dir: 'prev' | 'next') {
    setAnimDir(dir === 'prev' ? 'right' : 'left')
    setAnimKey((k) => k + 1)
    setSelectedDate((d) => addDays(d, dir === 'prev' ? -1 : 1))
    setPopover(null)
  }

  function goToday() {
    setAnimKey((k) => k + 1)
    setAnimDir('')
    setSelectedDate(new Date())
    setPopover(null)
  }

  // ── Override ────────────────────────────────────────────────────────────────
  async function handleToggle(
    entry: CalendarStaffEntry,
    action: 'mark_absent' | 'mark_present' | 'remove',
  ) {
    setSaving(entry.staff_id)
    setPopover(null)
    const supabase  = createClient()
    const isoDate   = toIsoDate(selectedDate)
    const { data: { user } } = await supabase.auth.getUser()

    if (action === 'remove' && entry.attendance) {
      await supabase.from('attendance').delete().eq('id', entry.attendance.id)
    } else if (action === 'mark_absent') {
      await supabase.from('attendance').upsert(
        {
          staff_id:    entry.staff_id,
          branch_id:   entry.branch_id,
          date:        isoDate,
          status:      'absent',
          notes:       'Override manual – tidak hadir',
          recorded_by: user?.id ?? null,
        },
        { onConflict: 'staff_id,date' },
      )
    } else if (action === 'mark_present') {
      await supabase.from('attendance').upsert(
        {
          staff_id:    entry.staff_id,
          branch_id:   entry.branch_id,
          date:        isoDate,
          status:      'present',
          notes:       'Override manual – hadir',
          recorded_by: user?.id ?? null,
        },
        { onConflict: 'staff_id,date' },
      )
    }

    setSaving(null)
    loadCalendar(selectedDate)
  }

  // ── Current time line ──────────────────────────────────────────────────────
  const now    = new Date()
  const curH   = now.getHours() + now.getMinutes() / 60
  const showNow = isSameDay(selectedDate, today) && curH >= GRID_START && curH <= GRID_END
  const nowTop  = (curH - GRID_START) * 2 * SLOT_HEIGHT

  // ── Date chips: 2 before + selected + 2 after ──────────────────────────────
  const dateChips = [-2, -1, 0, 1, 2].map((offset) => addDays(selectedDate, offset))

  // ── Summary counts ─────────────────────────────────────────────────────────
  const counts = (Object.keys(STATUS_CFG) as CalendarEffectiveStatus[]).map((s) => ({
    status: s,
    count: entries.filter((e) => e.effectiveStatus === s).length,
  }))

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes calSlideLeft {
          from { opacity: 0.3; transform: translateX(24px); }
          to   { opacity: 1;   transform: translateX(0);    }
        }
        @keyframes calSlideRight {
          from { opacity: 0.3; transform: translateX(-24px); }
          to   { opacity: 1;   transform: translateX(0);     }
        }
        @keyframes calFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        .cal-slide-left  { animation: calSlideLeft  220ms ease-out both; }
        .cal-slide-right { animation: calSlideRight 220ms ease-out both; }
        .cal-fade-in     { animation: calFadeIn     180ms ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .cal-slide-left, .cal-slide-right, .cal-fade-in { animation: none !important; }
        }
      ` }} />

      <div className="space-y-4 cal-fade-in">

        {/* ── Date navigation bar ── */}
        <div className="glass-card p-3 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate('prev')}
            aria-label="Hari sebelumnya"
            className="p-2 rounded-xl hover:bg-white/10 transition-colors duration-150 cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar py-0.5">
            {dateChips.map((d, i) => {
              const isSel   = isSameDay(d, selectedDate)
              const isToday = isSameDay(d, today)
              return (
                <button
                  key={i}
                  onClick={() => { setSelectedDate(d); setPopover(null) }}
                  className={[
                    'px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0',
                    isSel
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : isToday
                      ? 'border border-primary/50 text-primary hover:bg-primary/10'
                      : 'text-muted-foreground hover:bg-white/10 hover:text-foreground',
                  ].join(' ')}
                >
                  {formatDateLabel(d)}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => navigate('next')}
            aria-label="Hari berikutnya"
            className="p-2 rounded-xl hover:bg-white/10 transition-colors duration-150 cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
          >
            <ChevronRight size={16} />
          </button>

          {!isSameDay(selectedDate, today) && (
            <button
              onClick={goToday}
              className="px-2.5 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground shrink-0"
            >
              Hari Ini
            </button>
          )}
        </div>

        {/* ── Legend + counts ── */}
        <div className="flex items-center gap-3 flex-wrap text-xs">
          {(Object.entries(STATUS_CFG) as [CalendarEffectiveStatus, typeof STATUS_CFG[CalendarEffectiveStatus]][]).map(
            ([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded border ${cfg.blockBg} ${cfg.blockBorder}`} />
                <span className="text-muted-foreground">{cfg.label}</span>
              </div>
            ),
          )}
          <div className="flex items-center gap-1 ml-auto">
            <Info size={11} className="text-muted-foreground/60" />
            <span className="text-muted-foreground/60">Klik kolom untuk atur kehadiran</span>
          </div>
        </div>

        {/* ── Status summary chips ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {counts.map(({ status, count }) => {
            if (count === 0) return null
            const cfg = STATUS_CFG[status]
            return (
              <span
                key={status}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badgeCls}`}
              >
                {count} {cfg.label}
              </span>
            )
          })}
          {!loading && entries.length === 0 && (
            <span className="text-sm text-muted-foreground">
              Tidak ada jadwal untuk hari ini
            </span>
          )}
        </div>

        {/* ── Calendar grid ── */}
        <div className="glass-card overflow-hidden">
          {loading ? (
            <CalendarSkeleton />
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Calendar size={40} className="text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">
                Tidak ada jadwal untuk {formatDateLabel(selectedDate)}
              </p>
            </div>
          ) : (
            <div
              ref={gridRef}
              className={['overflow-x-auto', animDir === 'left' ? 'cal-slide-left' : animDir === 'right' ? 'cal-slide-right' : ''].join(' ')}
              key={animKey}
            >
              <div style={{ minWidth: `${60 + entries.length * COL_W}px` }}>

                {/* ─ Column headers ─ */}
                <div className="flex border-b border-border/40 bg-white/[0.03] sticky top-0 z-20">
                  {/* Time gutter */}
                  <div className="w-[60px] shrink-0 sticky left-0 z-30 bg-background/95 backdrop-blur-md border-r border-border/30 flex items-center justify-center py-3">
                    <span className="text-[9px] text-muted-foreground/50 uppercase tracking-widest font-mono">
                      Jam
                    </span>
                  </div>

                  {/* Staff headers */}
                  {entries.map((entry) => {
                    const cfg      = STATUS_CFG[entry.effectiveStatus]
                    const isSav    = saving === entry.staff_id
                    const isOverride = entry.effectiveStatus === 'OVERRIDE_AKTIF' || entry.effectiveStatus === 'OVERRIDE_OFF'

                    return (
                      <div
                        key={entry.staff_id}
                        className={[
                          `w-[${COL_W}px] shrink-0 flex flex-col items-center gap-1.5 px-2 py-3`,
                          'border-r border-border/20 cursor-pointer transition-colors duration-150 hover:bg-white/5 relative',
                          cfg.headerBg,
                          isSav ? 'opacity-50 pointer-events-none' : '',
                        ].join(' ')}
                        style={{ width: COL_W }}
                        onClick={(e) => {
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          setPopover({ entry, top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 240) })
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`${entry.full_name} – ${cfg.label}. Klik untuk atur kehadiran`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            setPopover({ entry, top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 240) })
                          }
                        }}
                      >
                        {/* Override dot */}
                        {isOverride && (
                          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                        )}
                        {/* Saving spinner */}
                        {isSav && (
                          <div className="absolute top-2 right-2 w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                        )}
                        {/* Avatar */}
                        <div
                          className={[
                            'w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold border',
                            cfg.blockBg, cfg.blockBorder, cfg.textColor,
                          ].join(' ')}
                        >
                          {getInitials(entry.full_name)}
                        </div>
                        {/* Name */}
                        <span className="text-[11px] font-medium text-foreground text-center leading-tight line-clamp-2">
                          {entry.full_name}
                        </span>
                        {/* Shift info */}
                        {entry.schedules_for_day.filter((s) => s.status === 'AKTIF').map((s) => (
                          <span key={s.id} className="text-[9px] text-muted-foreground/70 font-mono">
                            {s.jam_mulai?.slice(0, 5)}–{s.jam_selesai?.slice(0, 5)}
                          </span>
                        ))}
                        {/* Status badge */}
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${cfg.badgeCls}`}>
                          {cfg.label}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* ─ Time grid body ─ */}
                <div className="relative flex" style={{ height: TOTAL_HEIGHT }}>

                  {/* Time labels — sticky left */}
                  <div
                    className="w-[60px] shrink-0 sticky left-0 z-10 bg-background/80 backdrop-blur-sm border-r border-border/20"
                    style={{ height: TOTAL_HEIGHT }}
                  >
                    {TIME_SLOTS.map((slot, i) => (
                      <div
                        key={slot}
                        className="absolute w-full flex items-start justify-end pr-2 pt-0.5"
                        style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                      >
                        {slot.endsWith(':00') && (
                          <span className="text-[9px] text-muted-foreground/50 font-mono leading-none">
                            {slot}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Grid lines */}
                  <div className="absolute pointer-events-none" style={{ left: 60, right: 0, top: 0, bottom: 0 }}>
                    {TIME_SLOTS.map((slot, i) => (
                      <div
                        key={slot}
                        className={`absolute inset-x-0 border-t ${slot.endsWith(':00') ? 'border-border/20' : 'border-border/8'}`}
                        style={{ top: i * SLOT_HEIGHT }}
                      />
                    ))}
                  </div>

                  {/* Current time line */}
                  {showNow && (
                    <div
                      className="absolute z-20 pointer-events-none flex items-center"
                      style={{ top: nowTop, left: 60, right: 0 }}
                    >
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0 -ml-1" />
                      <div className="flex-1 h-px bg-primary/60" />
                    </div>
                  )}

                  {/* Staff columns */}
                  {entries.map((entry) => {
                    const cfg         = STATUS_CFG[entry.effectiveStatus]
                    const aktifScheds = entry.schedules_for_day.filter((s) => s.status === 'AKTIF')

                    return (
                      <div
                        key={entry.staff_id}
                        className="shrink-0 relative border-r border-border/15 cursor-pointer group"
                        style={{ width: COL_W, height: TOTAL_HEIGHT }}
                        onClick={(e) => {
                          if (saving === entry.staff_id) return
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          setPopover({ entry, top: r.top + 60, left: Math.min(r.left, window.innerWidth - 240) })
                        }}
                      >
                        {/* Hover highlight */}
                        <div className="absolute inset-0 bg-white/[0.015] opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none" />

                        {/* Shift blocks */}
                        {aktifScheds.length > 0 ? (
                          aktifScheds.map((sch) => {
                            const startH = parseHour(sch.jam_mulai?.slice(0, 5) ?? '08:00')
                            const endH   = parseHour(sch.jam_selesai?.slice(0, 5) ?? '15:00')
                            const top    = Math.max(0, (startH - GRID_START) * 2 * SLOT_HEIGHT)
                            const height = Math.max(SLOT_HEIGHT * 2, (endH - startH) * 2 * SLOT_HEIGHT)

                            return (
                              <div
                                key={sch.id}
                                className={[
                                  'absolute inset-x-1.5 rounded-xl border flex flex-col gap-0.5 p-2',
                                  'transition-transform duration-150 group-hover:scale-[1.015]',
                                  cfg.blockBg, cfg.blockBorder,
                                ].join(' ')}
                                style={{ top, height }}
                              >
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${cfg.textColor}`}>
                                  {sch.shift}
                                </span>
                                <span className="text-[9px] text-muted-foreground/70 font-mono">
                                  {sch.jam_mulai?.slice(0, 5)} – {sch.jam_selesai?.slice(0, 5)}
                                </span>
                                {entry.effectiveStatus === 'CUTI' && entry.leave && (
                                  <span className="text-[9px] text-amber-400/80 leading-tight line-clamp-3 mt-0.5">
                                    {entry.leave.reason}
                                  </span>
                                )}
                                {entry.effectiveStatus === 'OVERRIDE_OFF' && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <X size={8} className="text-destructive/70" />
                                    <span className="text-[9px] text-destructive/70">Override</span>
                                  </div>
                                )}
                                {entry.effectiveStatus === 'OVERRIDE_AKTIF' && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <div className="w-1 h-1 rounded-full bg-primary" />
                                    <span className="text-[9px] text-primary/80">Override</span>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        ) : entry.effectiveStatus === 'CUTI' && entry.leave ? (
                          /* On leave, no schedule — show full-day cuti block */
                          <div
                            className={`absolute inset-x-1.5 rounded-xl border flex flex-col gap-1 p-2 ${cfg.blockBg} ${cfg.blockBorder}`}
                            style={{
                              top:    (9 - GRID_START) * 2 * SLOT_HEIGHT,
                              height: 6 * 2 * SLOT_HEIGHT,
                            }}
                          >
                            <span className={`text-[9px] font-bold uppercase ${cfg.textColor}`}>
                              CUTI
                            </span>
                            <span className="text-[9px] text-amber-400/70 leading-tight line-clamp-4">
                              {entry.leave.reason}
                            </span>
                          </div>
                        ) : entry.effectiveStatus === 'OVERRIDE_OFF' ? (
                          /* Manually marked absent — show centered indicator */
                          <div
                            className={`absolute inset-x-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 ${cfg.blockBg} ${cfg.blockBorder}`}
                            style={{
                              top:    (9 - GRID_START) * 2 * SLOT_HEIGHT,
                              height: 4 * 2 * SLOT_HEIGHT,
                            }}
                          >
                            <X size={12} className="text-destructive/50" />
                            <span className="text-[9px] text-destructive/60">Tidak Hadir</span>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Override popover ── */}
      {popover && (
        <OverridePopover
          entry={popover.entry}
          top={popover.top}
          left={popover.left}
          onClose={() => setPopover(null)}
          onToggle={handleToggle}
        />
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Override Popover
// ══════════════════════════════════════════════════════════════════════════════
function OverridePopover({
  entry,
  top,
  left,
  onClose,
  onToggle,
}: {
  entry: CalendarStaffEntry
  top: number
  left: number
  onClose: () => void
  onToggle: (e: CalendarStaffEntry, a: 'mark_absent' | 'mark_present' | 'remove') => void
}) {
  const cfg = STATUS_CFG[entry.effectiveStatus]
  const isOverride = entry.effectiveStatus === 'OVERRIDE_AKTIF' || entry.effectiveStatus === 'OVERRIDE_OFF'

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Atur kehadiran"
        className="fixed z-50 w-56 glass-card p-3 space-y-2 shadow-2xl cal-fade-in"
        style={{ top: Math.min(top, window.innerHeight - 210), left: Math.max(8, left) }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 pb-2 border-b border-border/30">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0 ${cfg.blockBg} ${cfg.blockBorder} ${cfg.textColor}`}
          >
            {getInitials(entry.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{entry.full_name}</p>
            <p className={`text-[10px] ${cfg.textColor}`}>{cfg.label}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer p-1 transition-colors"
            aria-label="Tutup"
          >
            <X size={12} />
          </button>
        </div>

        {/* Leave info */}
        {entry.leave && (
          <div className="text-[10px] text-amber-400/80 bg-amber-500/10 rounded-lg px-2 py-1.5 leading-snug">
            Cuti: {entry.leave.reason}
          </div>
        )}

        {/* Attendance override info */}
        {entry.attendance && (
          <div className="text-[10px] text-primary/80 bg-primary/10 rounded-lg px-2 py-1.5">
            Override: {entry.attendance.notes ?? entry.attendance.status}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-0.5">
          {isOverride ? (
            <button
              onClick={() => onToggle(entry, 'remove')}
              className="w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-white/10 transition-colors cursor-pointer text-foreground flex items-center gap-2"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0" />
              Hapus Override (ikuti jadwal)
            </button>
          ) : (
            <>
              {entry.effectiveStatus !== 'OVERRIDE_OFF' && (
                <button
                  onClick={() => onToggle(entry, 'mark_absent')}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-destructive/10 transition-colors cursor-pointer text-destructive flex items-center gap-2"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                  Tandai Tidak Hadir
                </button>
              )}
              {(entry.effectiveStatus === 'OFF' || entry.effectiveStatus === 'CUTI') && (
                <button
                  onClick={() => onToggle(entry, 'mark_present')}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-[#34C759]/10 transition-colors cursor-pointer text-[#34C759] flex items-center gap-2"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#34C759] shrink-0" />
                  Tandai Hadir (override)
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Loading Skeleton
// ══════════════════════════════════════════════════════════════════════════════
function CalendarSkeleton() {
  const COLS = 5
  return (
    <div className="animate-pulse">
      {/* Header row */}
      <div className="flex border-b border-border/20 p-3 gap-3">
        <div className="w-[60px] shrink-0" />
        {Array.from({ length: COLS }).map((_, i) => (
          <div key={i} className="shrink-0 flex flex-col items-center gap-2 py-2" style={{ width: COL_W }}>
            <div className="w-9 h-9 rounded-full bg-white/8" />
            <div className="h-2.5 w-20 rounded bg-white/8" />
            <div className="h-2 w-10 rounded bg-white/5" />
          </div>
        ))}
      </div>
      {/* Body */}
      <div className="flex" style={{ height: 280 }}>
        <div className="w-[60px] shrink-0 space-y-9 pt-4 pr-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-2 w-8 bg-white/5 rounded ml-auto" />
          ))}
        </div>
        {Array.from({ length: COLS }).map((_, col) => (
          <div key={col} className="shrink-0 relative" style={{ width: COL_W, height: 280 }}>
            <div
              className="absolute inset-x-2 rounded-xl bg-white/5"
              style={{ top: 20 + col * 8, height: 120 + col * 15 }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
