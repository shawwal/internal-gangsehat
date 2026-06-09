'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, X, UserX, MoreVertical, Trash2 } from 'lucide-react'
import type { DailyVisit } from './types'
import { STATUS_COLOR, STATUS_BADGE, STATUS_LABEL } from './types'
import type { VisitStatus } from '@/types'

const ALL_STATUSES: VisitStatus[] = ['scheduled', 'completed', 'cancelled', 'no_show']

const STATUS_ICON: Record<VisitStatus, React.ReactNode> = {
  scheduled: <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />,
  completed: <Check size={10} className="text-[#34C759]" />,
  cancelled: <X size={10} className="text-destructive" />,
  no_show:   <UserX size={10} className="text-muted-foreground" />,
}

interface Props {
  visit: DailyVisit
  onStatusChange: (id: string, status: VisitStatus) => void
  onDelete: (id: string) => void
}

export function VisitCard({ visit, onStatusChange, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef  = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const colorCls = STATUS_COLOR[visit.status]

  return (
    <div
      className={[
        'relative rounded-lg border px-2 py-1.5 flex flex-col gap-0.5 group/card',
        'transition-all duration-150 hover:scale-[1.02] cursor-default',
        colorCls,
      ].join(' ')}
    >
      {/* Patient name + menu button */}
      <div className="flex items-start gap-1">
        <span className="text-[11px] font-semibold leading-tight flex-1 truncate">
          {visit.patient_name}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
          className="opacity-0 group-hover/card:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all cursor-pointer shrink-0"
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

      {/* Context menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute top-0 right-6 z-50 w-44 glass-card p-1 shadow-2xl rounded-xl border border-border/50"
          role="menu"
        >
          <p className="text-[9px] text-muted-foreground px-2 pt-1 pb-1.5 uppercase tracking-wider font-semibold">
            Ubah Status
          </p>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => { onStatusChange(visit.id, s); setMenuOpen(false) }}
              className={[
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer',
                s === visit.status
                  ? 'bg-white/10 font-semibold'
                  : 'hover:bg-white/5',
              ].join(' ')}
              role="menuitem"
            >
              {STATUS_ICON[s]}
              <span>{STATUS_LABEL[s]}</span>
            </button>
          ))}
          <hr className="border-border/30 my-1" />
          <button
            onClick={() => { onDelete(visit.id); setMenuOpen(false) }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            role="menuitem"
          >
            <Trash2 size={10} />
            Hapus Kunjungan
          </button>
        </div>
      )}
    </div>
  )
}
