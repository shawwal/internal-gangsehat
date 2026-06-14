'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, X, UserX, MoreVertical, Trash2 } from 'lucide-react'
import type { DailyVisit } from './types'
import { STATUS_COLOR, STATUS_BADGE, STATUS_LABEL } from './types'
import type { VisitStatus } from '@/types'

const ALL_STATUSES: VisitStatus[] = ['scheduled', 'completed', 'cancelled', 'no_show']

const STATUS_ICON: Record<VisitStatus, React.ReactNode> = {
  scheduled: <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />,
  completed: <Check size={12} className="text-[#34C759]" />,
  cancelled: <X size={12} className="text-destructive" />,
  no_show:   <UserX size={12} className="text-muted-foreground" />,
}

interface Props {
  visit: DailyVisit
  onStatusChange: (id: string, status: VisitStatus) => void
  onDelete: (id: string) => void
  onOpen: (id: string) => void
}

export function VisitCard({ visit, onStatusChange, onDelete, onOpen }: Props) {
  const [menuOpen, setMenuOpen]     = useState(false)
  const [menuPos, setMenuPos]       = useState<{ top: number; left: number } | null>(null)
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  function openMenu(e: React.MouseEvent) {
    e.stopPropagation()
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    // Prefer opening to the left; if near right edge, adjust
    const menuWidth = 208 // w-52
    const left = Math.min(rect.right, window.innerWidth - menuWidth - 8)
    setMenuPos({ top: rect.bottom + 4, left })
    setMenuOpen(true)
  }

  // Close on outside click or scroll
  useEffect(() => {
    if (!menuOpen) return
    function close() { setMenuOpen(false) }
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('scroll', close, true)
    }
  }, [menuOpen])

  const colorCls = STATUS_COLOR[visit.status]

  return (
    <div
      className={[
        'relative rounded-lg border px-2 py-1.5 flex flex-col gap-0.5 group/card cursor-default',
        'transition-all duration-150',
        menuOpen ? '' : 'hover:scale-[1.02]',   // suppress scale while menu is open
        colorCls,
      ].join(' ')}
    >
      {/* Patient name + menu button */}
      <div className="flex items-start gap-1">
        <button
          onClick={() => onOpen(visit.id)}
          className="text-[11px] font-semibold leading-tight flex-1 truncate text-left hover:underline cursor-pointer"
        >
          {visit.patient_name}
        </button>
        <button
          ref={btnRef}
          onClick={openMenu}
          className={[
            'p-0.5 rounded hover:bg-white/10 transition-all cursor-pointer shrink-0',
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100',
          ].join(' ')}
          aria-label="Menu kunjungan"
        >
          <MoreVertical size={10} />
        </button>
      </div>

      {/* Time + status row */}
      <div className="flex items-center gap-1.5">
        {visit.visit_time && (
          <span className="text-[9px] font-mono opacity-70">{visit.visit_time}</span>
        )}
        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${STATUS_BADGE[visit.status]}`}>
          {STATUS_LABEL[visit.status]}
        </span>
      </div>

      {/* Chief complaint preview */}
      {visit.chief_complaint && (
        <span className="text-[9px] opacity-60 truncate">{visit.chief_complaint}</span>
      )}

      {/* Context menu — portalled to body so it always paints above the grid */}
      {menuOpen && menuPos && createPortal(
        <>
          {/* Transparent backdrop to catch outside clicks */}
          <div className="fixed inset-0 z-200" onClick={() => setMenuOpen(false)} />

          <div
            ref={menuRef}
            role="menu"
            className="fixed z-201 w-52 rounded-xl border border-white/15 p-1.5 shadow-2xl backdrop-blur-xl bg-gray-900/95"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <p className="text-[10px] text-muted-foreground/70 px-2.5 pt-1 pb-2 uppercase tracking-widest font-semibold">
              Ubah Status
            </p>

            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => { onStatusChange(visit.id, s); setMenuOpen(false) }}
                className={[
                  'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors cursor-pointer',
                  s === visit.status
                    ? 'bg-white/10 font-semibold text-foreground'
                    : 'text-foreground/80 hover:bg-white/8 hover:text-foreground',
                ].join(' ')}
                role="menuitem"
              >
                {STATUS_ICON[s]}
                <span>{STATUS_LABEL[s]}</span>
                {s === visit.status && (
                  <Check size={11} className="ml-auto text-foreground/50" />
                )}
              </button>
            ))}

            <hr className="border-white/10 my-1.5" />

            <button
              onClick={() => { onDelete(visit.id); setMenuOpen(false) }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              role="menuitem"
            >
              <Trash2 size={13} />
              Hapus Kunjungan
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
