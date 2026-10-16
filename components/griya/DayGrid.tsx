'use client'

import { useEffect, useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { UserX, Check, RotateCcw } from 'lucide-react'
import type { GriyaWeek, GriyaTherapist, Hari } from '@/app/actions/griyaJadwal'
import { GRIYA_HOURS, DISCIPLINE_LABEL, DISCIPLINE_COLOR, HARI_LABEL } from './constants'
import { TherapistAvatar } from './TherapistAvatar'
import { TherapistDetailDialog } from './TherapistDetailDialog'
import { resolveDay, isTherapistOn, therapistColumns, type ResolvedCell } from './resolve'
import { SlotCell, type CellAction } from './SlotCell'
import type { MoveDest } from './MoveScopeDialog'

interface Props {
  week: GriyaWeek
  dateIso: string
  hari: Hari
  canEdit: boolean
  moveMode: boolean              // picking a destination cell for a move
  onCellAction: (action: CellAction, cell: ResolvedCell | undefined, cellKey: string) => void
  onDrop: (slotId: string, dest: MoveDest) => void
}

export function DayGrid({ week, dateIso, hari, canEdit, moveMode, onCellAction, onDrop }: Props) {
  const cols = therapistColumns(week.therapists)
  const { cells, unassigned } = resolveDay(week, dateIso)
  // Izin / tidak hadir are hidden from the daily grid (same as fisio jadwal
  // harian) so the freed spot reads as open; the visit stays in patient_visits
  // and is listed in the strip above the grid for undo/edit.
  const isAbsent = (c: ResolvedCell) =>
    c.state === 'izin' || c.state === 'alpa' ||
    (c.state === 'adhoc' && ['cancelled', 'no_show'].includes(c.visit?.status ?? ''))
  const absent = [...cells.values()].flat().filter(isAbsent)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [detailTherapist, setDetailTherapist] = useState<GriyaTherapist | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const apply = () => setIsMobile(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // group columns by discipline (in column order)
  const groups: { discipline: string; cols: typeof cols }[] = []
  for (const c of cols) {
    const last = groups[groups.length - 1]
    if (last && last.discipline === c.discipline) last.cols.push(c)
    else groups.push({ discipline: c.discipline, cols: [c] })
  }

  function handleDragEnd(e: DragEndEvent) {
    const cell = e.active.data.current?.cell as ResolvedCell | undefined
    const dropKey = e.over?.data.current?.cellKey as string | undefined
    if (!cell?.slot || !dropKey) return
    const [therapistId, hour] = dropKey.split('|')
    const col = cols.find((c) => c.therapist_id === therapistId)
    if (!col) return
    onDrop(cell.slot.id, {
      therapistId,
      therapistName: col.nickname || col.full_name,
      discipline: col.discipline,
      hari,
      hour,
      dateIso,
    })
  }

  if (cols.length === 0) {
    return (
      <div className="glass-card p-10 text-center text-sm text-muted-foreground">
        Belum ada kolom terapis. Klik &quot;Kelola Terapis&quot; untuk menambahkan.
      </div>
    )
  }

  // Narrower columns on phones so more therapists fit; scrolls horizontally either way.
  const colWidth = isMobile ? 96 : 120
  const gutter = isMobile ? 44 : 64

  return (
    <>
    {unassigned.length > 0 && (
      <div className="glass-card p-3 space-y-2 border border-amber-400/30 bg-amber-500/5 mb-3">
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <UserX size={13} /> Belum ada terapis bertugas ({unassigned.length})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {unassigned.map((u) => (
            <button
              key={u.key}
              onClick={() => onCellAction('coverUnassigned', u, u.key)}
              className="px-2.5 py-1.5 rounded-lg border border-amber-400/40 bg-background text-xs hover:bg-amber-500/10 cursor-pointer"
            >
              {u.studentName} · {u.hour}
            </button>
          ))}
        </div>
      </div>
    )}
    {absent.length > 0 && (
      <div className="glass-card p-3 space-y-2 mb-3">
        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <UserX size={13} /> Izin / Tidak Hadir hari ini ({absent.length})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {absent.map((a) => (
            <div
              key={`${a.key}-${a.visit?.id ?? a.slot?.id}`}
              className={`flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg border text-xs ${
                a.state === 'alpa' || a.visit?.status === 'no_show'
                  ? 'border-[#FF3B30]/40 bg-[#FF3B30]/5' : 'border-[#FFB35C]/50 bg-[#FFB35C]/10'
              }`}
            >
              <span>{a.studentName} · {a.hour}{a.reason ? ` · ${a.reason}` : ''}</span>
              {canEdit && (
                <>
                  <button
                    type="button" title="Ubah jadi Hadir" aria-label={`Tandai ${a.studentName} hadir`}
                    onClick={() => onCellAction('markPresent', a, a.key)}
                    className="p-1 rounded-md hover:bg-[#34C759]/15 text-[#34C759] cursor-pointer"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    type="button" title="Batalkan tanda" aria-label={`Batalkan tanda ${a.studentName}`}
                    onClick={() => onCellAction('unmarkAttendance', a, a.key)}
                    className="p-1 rounded-md hover:bg-muted text-muted-foreground cursor-pointer"
                  >
                    <RotateCcw size={12} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    )}
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="glass-card overflow-auto" style={{ maxHeight: 'calc(100dvh - 14rem)' }}>
        <div style={{ minWidth: gutter + cols.length * colWidth }}>
          {/* discipline band */}
          <div className="flex sticky top-0 z-20 bg-background">
            <div style={{ width: gutter }} className="shrink-0 sticky left-0 z-10 bg-background" />
            {groups.map((g, gi) => {
              const dc = DISCIPLINE_COLOR[g.discipline as keyof typeof DISCIPLINE_COLOR]
              return (
                <div key={g.discipline + gi} style={{ width: g.cols.length * colWidth }}
                  className={`text-[10px] font-bold uppercase tracking-widest py-1.5 text-center border-l border-white/20 ${dc?.band ?? 'bg-muted text-foreground'}`}>
                  {DISCIPLINE_LABEL[g.discipline as keyof typeof DISCIPLINE_LABEL]}
                </div>
              )
            })}
          </div>
          {/* therapist names */}
          <div className="flex sticky top-[26px] z-20 bg-background border-b border-border">
            <div style={{ width: gutter }} className="shrink-0 sticky left-0 z-10 bg-background flex items-center justify-center text-[10px] font-mono text-muted-foreground">
              {HARI_LABEL[hari].slice(0, 3)}
            </div>
            {cols.map((c) => {
              const dc = DISCIPLINE_COLOR[c.discipline]
              return (
                <div key={c.id} style={{ width: colWidth }}
                  className={`px-1 py-2 flex flex-col items-center gap-1 border-l border-border border-b-2 ${dc?.bar ?? 'border-b-border'} ${dc?.tint ?? ''}`}>
                  <button
                    type="button"
                    onClick={() => setDetailTherapist(c)}
                    aria-label={`Lihat detail ${c.nickname || c.full_name}`}
                    className="cursor-pointer rounded-full transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                  >
                    <TherapistAvatar name={c.nickname || c.full_name} url={c.avatar_url} discipline={c.discipline} size={isMobile ? 32 : 28} />
                  </button>
                  <span className="text-center text-[11px] font-semibold text-foreground leading-tight line-clamp-2 break-words max-w-full">
                    {c.nickname || c.full_name}
                  </span>
                </div>
              )
            })}
          </div>
          {/* hour rows */}
          {GRIYA_HOURS.map((hour) => (
            <div key={hour} className="flex items-start border-b border-border/40">
              <div style={{ width: gutter }} className="shrink-0 sticky left-0 z-10 bg-background flex items-start justify-end pr-1.5 sm:pr-2 pt-1.5 text-[11px] sm:text-[12px] font-mono text-muted-foreground">
                {hour}
              </div>
              {cols.map((c) => {
                const key = `${c.therapist_id}|${hour}`
                const all = cells.get(key) ?? []
                const stacked = all.filter((c) => !isAbsent(c))
                // A spot freed by an absence: clicking it finds a pengganti for today
                // (not a new recurring booking, which is what a truly empty cell does).
                const freedBy = stacked.length === 0 ? all.find(isAbsent) : undefined
                const therapistOn = isTherapistOn(week, c.therapist_id, hari, hour)
                return (
                  <div key={c.id} style={{ width: colWidth }} className="p-1 border-l border-border/40 space-y-1">
                    {stacked.length > 0 ? (
                      // Two bookings can resolve to the same therapist+hour (a genuine
                      // double-booking upstream — see resolve.ts's push()); show every one
                      // instead of silently dropping all but the last, which used to make
                      // a booking that's visible on jadwal mingguan vanish from jadwal harian.
                      stacked.map((cell, i) => (
                        <SlotCell
                          // Position in the resolved array, not slot/visit id — a "moved-out"
                          // ghost and its placed cell can share the same slot.id, and using
                          // that as the key made React reuse one DOM node for both, rendering
                          // a corrupted overlap of the two cards instead of two clean ones.
                          key={`${key}-${i}`}
                          cellKey={key}
                          stackIndex={stacked.length > 1 ? i : undefined}
                          cell={cell}
                          therapistOn={therapistOn}
                          canEdit={canEdit}
                          moveMode={moveMode}
                          onAction={(a, actedCell) => onCellAction(a, actedCell, key)}
                        />
                      ))
                    ) : (
                      <SlotCell
                        cellKey={key}
                        cell={undefined}
                        therapistOn={therapistOn}
                        canEdit={canEdit}
                        moveMode={moveMode}
                        onAction={(a, actedCell) =>
                          freedBy && a === 'assign'
                            ? onCellAction('substitute', freedBy, key)
                            : onCellAction(a, actedCell, key)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </DndContext>
    {detailTherapist && (
      <TherapistDetailDialog therapist={detailTherapist} onClose={() => setDetailTherapist(null)} />
    )}
    </>
  )
}
