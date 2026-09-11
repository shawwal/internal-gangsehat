'use client'

import { useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
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
  const cells = resolveDay(week, dateIso)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [detailTherapist, setDetailTherapist] = useState<GriyaTherapist | null>(null)

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

  const colWidth = 120

  return (
    <>
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="glass-card overflow-auto" style={{ maxHeight: 'calc(100vh - 16rem)' }}>
        <div style={{ minWidth: 64 + cols.length * colWidth }}>
          {/* discipline band */}
          <div className="flex sticky top-0 z-20 bg-background">
            <div className="w-16 shrink-0" />
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
            <div className="w-16 shrink-0 flex items-center justify-center text-[10px] font-mono text-muted-foreground">
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
                    <TherapistAvatar name={c.nickname || c.full_name} url={c.avatar_url} discipline={c.discipline} size={28} />
                  </button>
                  <span className="text-center text-[11px] font-semibold text-foreground leading-tight truncate max-w-full">
                    {c.nickname || c.full_name}
                  </span>
                </div>
              )
            })}
          </div>
          {/* hour rows */}
          {GRIYA_HOURS.map((hour) => (
            <div key={hour} className="flex border-b border-border/40">
              <div className="w-16 shrink-0 flex items-start justify-end pr-2 pt-1.5 text-[12px] font-mono text-muted-foreground">
                {hour}
              </div>
              {cols.map((c) => {
                const key = `${c.therapist_id}|${hour}`
                return (
                  <div key={c.id} style={{ width: colWidth }} className="p-1 border-l border-border/40">
                    <SlotCell
                      cellKey={key}
                      cell={cells.get(key)}
                      therapistOn={isTherapistOn(week, c.therapist_id, hari, hour)}
                      canEdit={canEdit}
                      moveMode={moveMode}
                      onAction={(a, cell) => onCellAction(a, cell, key)}
                    />
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
