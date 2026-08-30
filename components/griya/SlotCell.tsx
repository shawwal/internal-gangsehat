'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Plus, Check, UserX, Move, GraduationCap, CreditCard, ExternalLink, UserPlus2 } from 'lucide-react'
import type { ResolvedCell } from './resolve'

export type CellAction =
  | 'assign' | 'substitute' | 'attendance' | 'markPresent' | 'move' | 'end' | 'pay' | 'open'

interface Props {
  cellKey: string
  cell: ResolvedCell | undefined
  therapistOn: boolean
  canEdit: boolean
  moveMode: boolean
  onAction: (action: CellAction, cell: ResolvedCell | undefined) => void
}

const STATE_CLS: Record<string, string> = {
  scheduled: 'bg-primary/20 border-primary/60 text-foreground',
  hadir: 'bg-[#34C759] border-[#34C759] text-white',
  izin: 'bg-[#FFB35C]/30 border-[#FFB35C]/70 text-foreground',
  alpa: 'bg-[#FF3B30]/20 border-[#FF3B30]/70 text-foreground',
  'moved-out': 'bg-muted border-muted-foreground/40 text-muted-foreground line-through',
  adhoc: 'bg-purple-500/20 border-purple-500/70 text-foreground',
}

export function SlotCell({ cellKey, cell, therapistOn, canEdit, moveMode, onAction }: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  const draggableId = `drag:${cellKey}`
  const canDrag = canEdit && !!cell?.slot && (cell.state === 'scheduled' || cell.state === 'moved-out')
  const { attributes, listeners, setNodeRef: dragRef, isDragging } = useDraggable({
    id: draggableId, data: { cell }, disabled: !canDrag,
  })
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: `drop:${cellKey}`, data: { cellKey } })

  function setRefs(el: HTMLDivElement | null) { dragRef(el); dropRef(el) }

  if (!therapistOn && !cell) {
    return (
      <div
        className="h-full min-h-[44px] rounded-lg border border-muted-foreground/30 bg-muted"
        style={{ backgroundImage: 'repeating-linear-gradient(-45deg,transparent,transparent 5px,color-mix(in srgb,var(--muted-foreground) 55%,transparent) 5px,color-mix(in srgb,var(--muted-foreground) 55%,transparent) 7px)' }}
      />
    )
  }

  // Empty / freed cell
  const freed = !cell || cell.state === 'moved-out' || cell.state === 'izin' || cell.state === 'alpa'
  if (!cell || cell.state === 'moved-out') {
    return (
      <div
        ref={setRefs}
        onClick={() => canEdit && onAction(moveMode ? 'move' : 'assign', cell)}
        className={`group h-full min-h-[44px] rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
          moveMode ? 'border-primary/70 bg-primary/5 hover:bg-primary/15' : isOver ? 'border-primary bg-primary/10'
            : 'border-dashed border-[#34C759]/70 bg-[#34C759]/5 hover:bg-[#34C759]/15'
        }`}
      >
        {cell?.state === 'moved-out'
          ? <span className="text-[10px] text-muted-foreground line-through px-1 truncate">{cell.studentName}</span>
          : <Plus size={14} className="text-[#34C759] opacity-0 group-hover:opacity-100" />}
      </div>
    )
  }

  const cls = STATE_CLS[cell.state] ?? STATE_CLS.scheduled

  return (
    <>
      <div
        ref={setRefs}
        {...(canDrag ? { ...attributes, ...listeners } : {})}
        onClick={(e) => {
          if (moveMode) { onAction('move', cell); return }
          setMenu({ x: e.clientX, y: e.clientY })
        }}
        className={`h-full min-h-[44px] rounded-lg border px-1.5 py-1 text-[11px] leading-tight font-medium cursor-pointer overflow-hidden ${cls} ${
          isDragging ? 'opacity-40' : ''
        } ${isOver ? 'ring-2 ring-primary' : ''}`}
      >
        <span className="block truncate">{cell.studentName}</span>
        {cell.state === 'izin' && cell.reason && <span className="block truncate text-[9px] opacity-80">{cell.reason}</span>}
        {cell.state === 'adhoc' && <span className="block truncate text-[9px] opacity-80">pengganti</span>}
      </div>

      {menu && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setMenu(null)} />
          <div
            className="fixed z-[61] glass-card p-1.5 w-52 text-sm shadow-2xl"
            style={{ top: Math.min(menu.y, window.innerHeight - 320), left: Math.min(menu.x, window.innerWidth - 220) }}
          >
            {cell.slot && cell.state === 'scheduled' && canEdit && (
              <>
                <MenuBtn icon={<Check size={14} />} label="Tandai Hadir" onClick={() => { setMenu(null); onAction('markPresent', cell) }} />
                <MenuBtn icon={<UserX size={14} />} label="Tandai Tidak Hadir" onClick={() => { setMenu(null); onAction('attendance', cell) }} />
                <MenuBtn icon={<Move size={14} />} label="Pindahkan" onClick={() => { setMenu(null); onAction('move', cell) }} />
                <MenuBtn icon={<GraduationCap size={14} />} label="Akhiri Jadwal" onClick={() => { setMenu(null); onAction('end', cell) }} />
              </>
            )}
            {cell.slot && (cell.state === 'hadir' || cell.state === 'izin' || cell.state === 'alpa') && canEdit && (
              <MenuBtn icon={<Check size={14} />} label="Ubah jadi Hadir" onClick={() => { setMenu(null); onAction('markPresent', cell) }} />
            )}
            {freed && canEdit && (
              <MenuBtn icon={<UserPlus2 size={14} />} label="Cari Pengganti" onClick={() => { setMenu(null); onAction('substitute', cell) }} />
            )}
            {canEdit && <MenuBtn icon={<CreditCard size={14} />} label="Bayar" onClick={() => { setMenu(null); onAction('pay', cell) }} />}
            <MenuBtn icon={<ExternalLink size={14} />} label="Lihat Siswa" onClick={() => { setMenu(null); onAction('open', cell) }} />
          </div>
        </>,
        document.body,
      )}
    </>
  )
}

function MenuBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 text-left cursor-pointer">
      {icon}{label}
    </button>
  )
}
