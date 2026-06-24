'use client'

import { useState } from 'react'
import { AlertCircle, CalendarX, Plus } from 'lucide-react'
import type { DailyVisit, DayStaffEntry, AssignTarget, PendingLeaveInfo } from './types'
import {
  GRID_START, GRID_END, SLOT_H, TIME_COL_W, STAFF_COL_W,
} from './types'
import type { VisitStatus } from '@/types'
import { VisitCard } from './VisitCard'

// ── Helpers ────────────────────────────────────────────────────────────────────
function parseHour(hhmm: string): number {
  return parseInt(hhmm.split(':')[0], 10)
}

function fmtHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0] ?? '').join('').toUpperCase()
}

function displayName(entry: DayStaffEntry) {
  return entry.nickname || entry.full_name
}

// ── Staff avatar ───────────────────────────────────────────────────────────────
function StaffAvatar({ entry }: { entry: DayStaffEntry }) {
  const [imgError, setImgError] = useState(false)
  const showImg = !!entry.avatar_url && !imgError

  const ringCls = entry.isOnLeave
    ? 'border-amber-400/60'
    : entry.pendingLeave
    ? 'border-yellow-400/50'
    : 'border-white/40'

  return (
    <div className={`w-11 h-11 rounded-full border-2 overflow-hidden shrink-0 ${ringCls}`}>
      {showImg ? (
        <img
          src={entry.avatar_url!}
          alt={entry.full_name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className={[
            'w-full h-full flex items-center justify-center text-sm font-bold',
            entry.isOnLeave
              ? 'bg-amber-500/30 text-amber-200'
              : entry.pendingLeave
              ? 'bg-yellow-500/20 text-yellow-200'
              : 'bg-white/20 text-white',
          ].join(' ')}
        >
          {getInitials(entry.nickname || entry.full_name)}
        </div>
      )}
    </div>
  )
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  staff: DayStaffEntry[]
  visits: DailyVisit[]
  date: string           // ISO yyyy-mm-dd
  userRole?: string | null
  onAssign: (target: AssignTarget) => void
  onStatusChange: (visitId: string, status: VisitStatus) => void
  onDelete: (visitId: string) => void
  onOpen: (visitId: string) => void
  onPendingLeaveClick: (staffName: string, leave: PendingLeaveInfo) => void
  onStaffClick: (staffId: string) => void
  onNoShow?: (visitId: string) => void
  onPayment?: (visitId: string) => void
}

// ── Component ──────────────────────────────────────────────────────────────────
export function DailyGrid({ staff, visits, date, userRole, onAssign, onStatusChange, onDelete, onOpen, onPendingLeaveClick, onStaffClick, onNoShow, onPayment }: Props) {
  // Current time (used later for time line after range is known)
  const now   = new Date()
  const today = now.toISOString().split('T')[0]
  const curH  = now.getHours() + now.getMinutes() / 60

  // Group visits: staffId → hour → visits[]
  const visitMap = new Map<string, Map<number, DailyVisit[]>>()
  const untimedVisits = new Map<string, DailyVisit[]>()

  for (const v of visits) {
    const sid = v.attending_staff_id ?? '__unassigned__'
    if (!v.visit_time) {
      const list = untimedVisits.get(sid) ?? []
      list.push(v)
      untimedVisits.set(sid, list)
      continue
    }
    const hour = parseHour(v.visit_time)
    if (!visitMap.has(sid)) visitMap.set(sid, new Map())
    const hourMap = visitMap.get(sid)!
    const list    = hourMap.get(hour) ?? []
    list.push(v)
    hourMap.set(hour, list)
  }

  // Dynamic visible hour range — trim rows with no shifts or visits
  const shiftHours: number[] = []
  for (const s of staff) {
    if (s.hasSchedule && !s.isOnLeave) {
      shiftHours.push(parseHour(s.jam_mulai), parseHour(s.jam_selesai))
    }
  }
  const visitHoursList: number[] = []
  for (const v of visits) {
    if (v.visit_time) visitHoursList.push(parseHour(v.visit_time))
  }
  const allDataHours  = [...shiftHours, ...visitHoursList]
  const effectiveStart = allDataHours.length > 0 ? Math.max(GRID_START, Math.min(...allDataHours)) : GRID_START
  const effectiveEnd   = allDataHours.length > 0 ? Math.min(GRID_END,   Math.max(...allDataHours) + 1) : GRID_END
  const HOURS_VISIBLE  = Array.from({ length: effectiveEnd - effectiveStart }, (_, i) => effectiveStart + i)
  const totalH         = HOURS_VISIBLE.length * SLOT_H

  // Current time line
  const showNow = date === today && curH >= effectiveStart && curH < effectiveEnd
  const nowTop  = (curH - effectiveStart) * SLOT_H

  if (staff.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <CalendarX size={44} className="text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground">Tidak ada terapis terjadwal untuk hari ini</p>
      </div>
    )
  }

  const minWidth = TIME_COL_W + staff.length * STAFF_COL_W

  return (
    <div className="h-full overflow-auto scrollbar-thin">
      <div style={{ minWidth }}>

        {/* ── Column headers ─── */}
        <div
          className="flex sticky top-0 z-20 border-b border-white/10"
          style={{
            background: 'linear-gradient(135deg, #3B0764 0%, #6D28D9 50%, #FF0090 100%)',
          }}
        >
          {/* Time gutter header */}
          <div
            className="shrink-0 flex items-end justify-center pb-3 sticky left-0 z-30"
            style={{ width: TIME_COL_W, background: 'inherit' }}
          >
            <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Jam</span>
          </div>

          {/* Staff columns */}
          {staff.map((s) => (
            <div
              key={s.staff_id}
              className="shrink-0 flex flex-col items-center gap-2 px-2 py-4 border-l border-white/10"
              style={{ width: STAFF_COL_W }}
            >
              {/* Avatar + Name — clickable, hover shows full name */}
              <button
                onClick={() => onStaffClick(s.staff_id)}
                className="flex flex-col items-center gap-2 group/staff focus:outline-none"
                title={s.nickname ? s.full_name : undefined}
              >
                <StaffAvatar entry={s} />
                <p className="text-[12px] font-semibold text-white text-center leading-tight line-clamp-2 group-hover/staff:underline decoration-white/40 underline-offset-2">
                  {displayName(s)}
                </p>
              </button>

              {/* Shift + leave badges */}
              <div className="flex items-center gap-1 flex-wrap justify-center">
                {s.isOnLeave ? (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 font-bold uppercase">
                    CUTI
                  </span>
                ) : s.hasSchedule ? (
                  <>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      s.isOverride ? 'bg-secondary/30 text-secondary' : 'bg-white/20 text-white/90'
                    }`}>
                      {s.shift}
                    </span>
                    <span className={`text-[9px] font-mono ${s.isOverride ? 'text-secondary/70' : 'text-white/50'}`}>
                      {s.jam_mulai}–{s.jam_selesai}
                    </span>
                    {s.isOverride && (
                      <span className="text-[9px] font-bold text-secondary/70 uppercase tracking-wide">TEMP</span>
                    )}
                  </>
                ) : (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-white/40 font-medium text-center leading-tight">
                    Tidak ada jadwal
                  </span>
                )}

                {/* Pending leave badge — shown alongside shift info (not yet approved) */}
                {s.pendingLeave && !s.isOnLeave && (
                  <button
                    onClick={() => onPendingLeaveClick(s.full_name, s.pendingLeave!)}
                    className="flex items-center gap-0.5 text-[9px] px-2 py-0.5 rounded-full bg-yellow-500/25 text-yellow-200 font-bold uppercase border border-yellow-400/30 hover:bg-yellow-500/40 transition-colors cursor-pointer"
                    title="Klik untuk tinjau pengajuan cuti"
                  >
                    <AlertCircle size={8} className="shrink-0" />
                    PENGAJUAN
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Untimemed visits row (visits with no visit_time) ─── */}
        {[...untimedVisits.values()].some((v) => v.length > 0) && (
          <div className="flex border-b border-border/20 bg-secondary/5">
            <div
              className="shrink-0 sticky left-0 z-10 bg-background/90 backdrop-blur-sm border-r border-border/20 flex items-center justify-end pr-2"
              style={{ width: TIME_COL_W }}
            >
              <span className="text-[9px] text-muted-foreground/50 font-mono text-right leading-tight">
                Belum<br/>ditentukan
              </span>
            </div>
            {staff.map((s) => {
              const cellVisits = untimedVisits.get(s.staff_id) ?? []
              return (
                <div
                  key={s.staff_id}
                  className="shrink-0 border-l border-border/30 p-1.5 flex flex-col gap-1"
                  style={{ width: STAFF_COL_W, minHeight: 48 }}
                >
                  {cellVisits.map((v) => (
                    <VisitCard
                      key={v.id}
                      visit={v}
                      userRole={userRole}
                      onStatusChange={onStatusChange}
                      onDelete={onDelete}
                      onOpen={onOpen}
                      onNoShow={onNoShow}
                      onPayment={onPayment}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Time grid body ─── */}
        <div className="relative flex" style={{ height: totalH }}>

          {/* Time labels — sticky left */}
          <div
            className="shrink-0 sticky left-0 z-10 bg-background/90 backdrop-blur-sm border-r border-border/40"
            style={{ width: TIME_COL_W, height: totalH }}
          >
            {HOURS_VISIBLE.map((h, i) => (
              <div
                key={h}
                className="absolute w-full flex items-center justify-end pr-3"
                style={{ top: i * SLOT_H, height: SLOT_H }}
              >
                {h === 14 ? (
                  <span className="text-[17px] text-muted-foreground/60 font-mono">
                    14:00
                  </span>
                ) : (
                  <span className="text-[17px] text-muted-foreground/60 font-mono">
                    {fmtHour(h)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Horizontal grid lines */}
          <div
            className="absolute pointer-events-none"
            style={{ left: TIME_COL_W, right: 0, top: 0, bottom: 0 }}
          >
            {/* Afternoon tint — subtle warm overlay from 14:00 onwards */}
            {HOURS_VISIBLE.includes(14) && (
              <div
                className="absolute inset-x-0 bottom-0 pointer-events-none"
                style={{
                  top: (HOURS_VISIBLE.indexOf(14)) * SLOT_H,
                  background: 'linear-gradient(180deg, rgba(255,179,92,0.04) 0%, rgba(255,0,144,0.03) 100%)',
                }}
              />
            )}
            {HOURS_VISIBLE.map((h, i) => (
              h === 14 ? (
                <div
                  key={h}
                  className="absolute inset-x-0 pointer-events-none"
                  style={{ top: i * SLOT_H }}
                >
                  {/* Thick gradient divider line */}
                  <div
                    className="h-0.5 w-full"
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, #FF0090 12%, #FFB35C 50%, #FF0090 88%, transparent 100%)',
                      opacity: 0.75,
                    }}
                  />
                  {/* Centered "SHIFT SORE" label — transform centers it on the line */}
                  <div className="absolute inset-x-0 flex justify-center" style={{ top: 0, transform: 'translateY(-50%)' }}>
                    <span
                      className="text-[9px] font-bold uppercase tracking-widest px-3 py-0.5 rounded-full border"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,0,144,0.18), rgba(255,179,92,0.15))',
                        borderColor: 'rgba(255,0,144,0.35)',
                        color: '#FFB35C',
                        backdropFilter: 'blur(6px)',
                      }}
                    >
                      ☀ Shift Sore
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-border/40"
                  style={{ top: i * SLOT_H }}
                />
              )
            ))}
          </div>

          {/* Current time line */}
          {showNow && (
            <div
              className="absolute z-20 pointer-events-none flex items-center"
              style={{ top: nowTop, left: 0, right: 0 }}
            >
              {/* Time label inside the time gutter */}
              <div
                className="shrink-0 flex items-center justify-end pr-2"
                style={{ width: TIME_COL_W }}
              >
                <span className="text-[11px] font-bold font-mono text-primary bg-primary/15 px-1.5 py-0.5 rounded-md leading-none">
                  {String(Math.floor(curH)).padStart(2, '0')}:{String(Math.round((curH % 1) * 60)).padStart(2, '0')}
                </span>
              </div>
              {/* Dot + line */}
              <div className="w-3 h-3 rounded-full bg-primary shrink-0 -ml-1.5 shadow-[0_0_8px_3px_rgba(255,0,144,0.5)]" />
              <div className="flex-1 h-0.5 bg-linear-to-r from-primary to-primary/20" />
            </div>
          )}

          {/* Staff columns */}
          {staff.map((s) => {
            const hourMap = visitMap.get(s.staff_id)

            // Shade the scheduled shift window
            const shiftTop    = s.hasSchedule ? Math.max(0, (parseHour(s.jam_mulai) - effectiveStart) * SLOT_H) : null
            const shiftBottom = s.hasSchedule ? Math.min(totalH, (parseHour(s.jam_selesai) - effectiveStart) * SLOT_H) : null

            return (
              <div
                key={s.staff_id}
                className="shrink-0 relative border-l border-border/30"
                style={{ width: STAFF_COL_W, height: totalH }}
              >
                {/* Shift window shading */}
                {shiftTop !== null && shiftBottom !== null && !s.isOnLeave && (
                  <div
                    className="absolute inset-x-0 bg-foreground/4 pointer-events-none"
                    style={{ top: shiftTop, height: shiftBottom - shiftTop }}
                  />
                )}

                {/* Approved leave overlay */}
                {s.isOnLeave && (
                  <div className="absolute inset-0 bg-amber-500/10 pointer-events-none" />
                )}

                {/* Pending leave overlay */}
                {s.pendingLeave && !s.isOnLeave && (
                  <div className="absolute inset-0 bg-yellow-500/6 pointer-events-none" />
                )}

                {/* Time slot cells */}
                {HOURS_VISIBLE.map((h, i) => {
                  const cellVisits = hourMap?.get(h) ?? []
                  const isInShift  = s.hasSchedule && !s.isOnLeave
                    && parseHour(s.jam_mulai) <= h && h < parseHour(s.jam_selesai)

                  const unavailable = !isInShift && !s.isOnLeave && s.hasSchedule

                  return (
                    <div
                      key={h}
                      className="absolute inset-x-0 flex flex-col gap-1 p-1 group"
                      style={{ top: i * SLOT_H, height: SLOT_H }}
                    >
                      {/* Hover tooltip — shows therapist name + time */}
                      {isInShift && !s.isOnLeave && (
                        <div className="absolute top-1.5 left-1.5 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-10">
                          <span className="text-[17px] font-semibold text-white bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md leading-none whitespace-nowrap">
                            {displayName(s)}
                          </span>
                          <span className="text-[17px] font-mono text-primary/90 bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded-md leading-none">
                            {fmtHour(h)}
                          </span>
                        </div>
                      )}

                      {/* Outside-shift hatched overlay — pointer-events-none so visit cards stay clickable */}
                      {unavailable && (
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 5px, color-mix(in srgb, currentColor 7%, transparent) 5px, color-mix(in srgb, currentColor 7%, transparent) 6px)',
                          }}
                        />
                      )}

                      {/* Visit cards */}
                      {cellVisits.map((v) => (
                        <VisitCard
                          key={v.id}
                          visit={v}
                          userRole={userRole}
                          onStatusChange={onStatusChange}
                          onDelete={onDelete}
                          onOpen={onOpen}
                          onNoShow={onNoShow}
                          onPayment={onPayment}
                        />
                      ))}

                      {/* Add button — only for in-shift, non-leave, empty cells */}
                      {cellVisits.length === 0 && isInShift && !s.isOnLeave && (
                        <button
                          onClick={() =>
                            onAssign({
                              staffId:   s.staff_id,
                              staffName: s.full_name,
                              branchId:  s.branch_id,
                              hour:      h,
                              date,
                            })
                          }
                          className="w-full flex-1 flex items-center justify-center rounded-lg border border-dashed opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer border-[#34C759]/40 hover:bg-[#34C759]/8 hover:border-[#34C759]/70"
                          aria-label={`Tambah kunjungan — ${s.full_name} jam ${fmtHour(h)}`}
                        >
                          <Plus size={14} className="text-[#34C759]/60" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
