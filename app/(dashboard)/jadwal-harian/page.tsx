'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchDailyVisits, updateVisitStatus, deleteVisit } from '@/app/actions/jadwal'
import { DailyGrid } from '@/components/jadwal/DailyGrid'
import { AssignDialog } from '@/components/jadwal/AssignDialog'
import type { DayStaffEntry, AssignTarget } from '@/components/jadwal/types'
import type { DailyVisit } from '@/app/actions/jadwal'
import type { VisitStatus } from '@/types'

// ── Date helpers ───────────────────────────────────────────────────────────────
const JS_DAY_TO_HARI = ['AHAD', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'] as const
const HARI_LABEL: Record<string, string> = {
  SENIN: 'Senin', SELASA: 'Selasa', RABU: 'Rabu', KAMIS: 'Kamis',
  JUMAT: 'Jumat', SABTU: 'Sabtu', AHAD: 'Ahad',
}
const MONTH_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function fmtHeaderDate(d: Date) {
  const hari = HARI_LABEL[JS_DAY_TO_HARI[d.getDay()]] ?? JS_DAY_TO_HARI[d.getDay()]
  return `${hari}, ${d.getDate()} ${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`
}

function toHariIndonesia(d: Date) {
  return JS_DAY_TO_HARI[d.getDay()]
}

// ── Visit status counts ────────────────────────────────────────────────────────
const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  scheduled: 'Terjadwal',
  completed: 'Selesai',
  cancelled: 'Batal',
  no_show:   'Tdk Hadir',
}
const VISIT_STATUS_COLORS: Record<VisitStatus, string> = {
  scheduled: 'bg-blue-500/20 text-blue-300',
  completed: 'bg-[#34C759]/20 text-[#34C759]',
  cancelled: 'bg-destructive/15 text-destructive',
  no_show:   'bg-muted/30 text-muted-foreground',
}

// ══════════════════════════════════════════════════════════════════════════════
// Page
// ══════════════════════════════════════════════════════════════════════════════
export default function JadwalHarianPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [staff, setStaff]               = useState<DayStaffEntry[]>([])
  const [visits, setVisits]             = useState<DailyVisit[]>([])
  const [loading, setLoading]           = useState(true)
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null)
  const today = new Date()

  // ── Load everything for a date ─────────────────────────────────────────────
  const loadAll = useCallback(async (date: Date) => {
    setLoading(true)
    const supabase = createClient()
    const isoDate  = toIso(date)
    const hari     = toHariIndonesia(date)

    const [schedulesRes, leavesRes, visitsData] = await Promise.all([
      supabase
        .from('schedules')
        .select('staff_id, branch_id, shift, jam_mulai, jam_selesai, status, internal_profiles!staff_id(full_name)')
        .eq('hari', hari)
        .eq('status', 'AKTIF'),
      supabase
        .from('leave_requests')
        .select('staff_id, reason')
        .eq('status', 'approved')
        .lte('start_date', isoDate)
        .gte('end_date', isoDate),
      fetchDailyVisits(isoDate),
    ])

    const leaveMap = new Map<string, string>()
    for (const l of leavesRes.data ?? []) {
      leaveMap.set(l.staff_id, l.reason ?? '')
    }

    // Build staff entries from schedules
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries = new Map<string, DayStaffEntry>()
    for (const row of (schedulesRes.data ?? []) as any[]) {
      const sid = row.staff_id as string
      if (entries.has(sid)) continue  // already added
      entries.set(sid, {
        staff_id:   sid,
        full_name:  row.internal_profiles?.full_name ?? 'Unknown',
        branch_id:  row.branch_id ?? null,
        shift:      row.shift,
        jam_mulai:  row.jam_mulai?.slice(0, 5) ?? '08:00',
        jam_selesai: row.jam_selesai?.slice(0, 5) ?? '17:00',
        isOnLeave:  leaveMap.has(sid),
        leaveReason: leaveMap.get(sid) ?? null,
        hasSchedule: true,
      })
    }

    // Also include staff who have visits today but no schedule (rare edge case)
    for (const v of visitsData) {
      const sid = v.attending_staff_id
      if (!sid || entries.has(sid)) continue
      // Try to get name from schedules or leave; otherwise unknown
      entries.set(sid, {
        staff_id:    sid,
        full_name:   'Staff',     // name will be overridden if found
        branch_id:   v.branch_id ?? null,
        shift:       '',
        jam_mulai:   '08:00',
        jam_selesai: '20:00',
        isOnLeave:   leaveMap.has(sid),
        leaveReason: leaveMap.get(sid) ?? null,
        hasSchedule: false,
      })
    }

    // Resolve names for edge-case staff (fetch from profiles)
    const unknownIds = [...entries.values()].filter((s) => s.full_name === 'Staff').map((s) => s.staff_id)
    if (unknownIds.length > 0) {
      const { data: profiles } = await supabase
        .from('internal_profiles')
        .select('id, full_name')
        .in('id', unknownIds)
      for (const p of profiles ?? []) {
        const entry = entries.get(p.id)
        if (entry) entry.full_name = p.full_name
      }
    }

    // Sort: on-leave last
    const sorted = [...entries.values()].sort((a, b) => {
      if (a.isOnLeave !== b.isOnLeave) return a.isOnLeave ? 1 : -1
      return a.full_name.localeCompare(b.full_name)
    })

    setStaff(sorted)
    setVisits(visitsData)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll(selectedDate) }, [selectedDate, loadAll])

  // ── Navigation ─────────────────────────────────────────────────────────────
  function navigate(dir: 'prev' | 'next') {
    setSelectedDate((d) => addDays(d, dir === 'prev' ? -1 : 1))
  }

  // ── Visit handlers ─────────────────────────────────────────────────────────
  async function handleStatusChange(visitId: string, status: VisitStatus) {
    // Optimistic update
    setVisits((vs) => vs.map((v) => v.id === visitId ? { ...v, status } : v))
    await updateVisitStatus(visitId, status)
  }

  async function handleDelete(visitId: string) {
    setVisits((vs) => vs.filter((v) => v.id !== visitId))
    await deleteVisit(visitId)
  }

  // ── Summary counts ─────────────────────────────────────────────────────────
  const counts = (['scheduled', 'completed', 'cancelled', 'no_show'] as VisitStatus[]).map((s) => ({
    status: s,
    count:  visits.filter((v) => v.status === s).length,
  }))

  // ── Date chips ─────────────────────────────────────────────────────────────
  const dateChips = [-3, -2, -1, 0, 1, 2, 3].map((n) => addDays(selectedDate, n))

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes jFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .j-fade-in { animation: jFadeIn 200ms ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .j-fade-in { animation: none; }
        }
      ` }} />

      <div className="space-y-5 j-fade-in">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
              <CalendarClock size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Jadwal Harian</h1>
              <p className="text-sm text-muted-foreground">
                {fmtHeaderDate(selectedDate)}
              </p>
            </div>
          </div>

          <button
            onClick={() => loadAll(selectedDate)}
            title="Refresh"
            className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* ── Date navigation ── */}
        <div className="glass-card p-3 flex items-center gap-2">
          <button
            onClick={() => navigate('prev')}
            aria-label="Hari sebelumnya"
            className="p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {dateChips.map((d, i) => {
              const isSel   = isSameDay(d, selectedDate)
              const isTod   = isSameDay(d, today)
              const dayName = HARI_LABEL[JS_DAY_TO_HARI[d.getDay()]]
              const dayNum  = d.getDate()
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(d)}
                  className={[
                    'flex flex-col items-center px-3 py-2 rounded-xl shrink-0 transition-all duration-150 cursor-pointer min-w-[52px]',
                    isSel
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : isTod
                      ? 'border border-primary/50 text-primary hover:bg-primary/10'
                      : 'text-muted-foreground hover:bg-white/10 hover:text-foreground',
                  ].join(' ')}
                >
                  <span className="text-[10px] font-medium uppercase">{dayName?.slice(0, 3)}</span>
                  <span className="text-lg font-bold leading-none">{dayNum}</span>
                </button>
              )
            })}
          </div>

          <button
            onClick={() => navigate('next')}
            aria-label="Hari berikutnya"
            className="p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
          >
            <ChevronRight size={16} />
          </button>

          {!isSameDay(selectedDate, today) && (
            <button
              onClick={() => setSelectedDate(new Date())}
              className="px-3 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors cursor-pointer text-muted-foreground shrink-0"
            >
              Hari Ini
            </button>
          )}
        </div>

        {/* ── Visit summary chips ── */}
        {!loading && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground font-medium">
              {visits.length} kunjungan
            </span>
            {counts.filter((c) => c.count > 0).map(({ status, count }) => (
              <span
                key={status}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${VISIT_STATUS_COLORS[status]}`}
              >
                {count} {VISIT_STATUS_LABELS[status]}
              </span>
            ))}
            {staff.length > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">
                {staff.filter((s) => !s.isOnLeave).length} terapis aktif
                {staff.filter((s) => s.isOnLeave).length > 0 &&
                  ` · ${staff.filter((s) => s.isOnLeave).length} cuti`}
              </span>
            )}
          </div>
        )}

        {/* ── Grid ── */}
        <div className="glass-card overflow-hidden">
          {loading ? (
            <GridSkeleton />
          ) : (
            <DailyGrid
              staff={staff}
              visits={visits}
              date={toIso(selectedDate)}
              onAssign={setAssignTarget}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          )}
        </div>

        {/* ── Legend ── */}
        <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground pb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border bg-blue-500/20 border-blue-400/50" />
            <span>Terjadwal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border bg-[#34C759]/20 border-[#34C759]/50" />
            <span>Selesai</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border bg-destructive/20 border-destructive/50" />
            <span>Batal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border bg-muted/30 border-border/40" />
            <span>Tidak Hadir</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span>Waktu sekarang</span>
          </div>
        </div>
      </div>

      {/* ── Assign dialog ── */}
      {assignTarget && (
        <AssignDialog
          target={assignTarget}
          onClose={() => setAssignTarget(null)}
          onSaved={() => {
            setAssignTarget(null)
            loadAll(selectedDate)
          }}
        />
      )}
    </>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function GridSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div
        className="flex border-b border-white/10 p-4 gap-4"
        style={{ background: 'linear-gradient(135deg, #3B0764 0%, #6D28D9 50%, #FF0090 100%)' }}
      >
        <div className="w-[72px] shrink-0" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="w-[176px] shrink-0 flex flex-col items-center gap-2 py-2">
            <div className="w-11 h-11 rounded-full bg-white/20" />
            <div className="h-3 w-24 rounded bg-white/20" />
            <div className="h-2 w-16 rounded bg-white/10" />
          </div>
        ))}
      </div>
      {/* Body rows */}
      {[1, 2, 3, 4, 5, 6].map((r) => (
        <div key={r} className="flex border-b border-border/10" style={{ height: 80 }}>
          <div className="w-[72px] shrink-0 flex items-start justify-end pr-3 pt-2">
            <div className="h-2.5 w-10 rounded bg-white/5" />
          </div>
          {[1, 2, 3, 4].map((c) => (
            <div key={c} className="w-[176px] shrink-0 border-l border-border/10 p-1">
              {r === 2 && c === 1 && <div className="h-14 rounded-lg bg-[#34C759]/10" />}
              {r === 3 && c === 3 && <div className="h-14 rounded-lg bg-blue-500/10" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
