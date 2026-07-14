'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, X, UserX, Trash2, CreditCard, BanknoteArrowUp, BellRing } from 'lucide-react'
import type { DailyVisit } from './types'
import { STATUS_COLOR, STATUS_BADGE, STATUS_LABEL } from './types'
import type { VisitStatus } from '@/types'

const PAYMENT_ROLES = ['finance', 'manager', 'director', 'admin']
const REMIND_ROLES  = ['admin', 'director', 'manager']

const ALL_STATUSES: VisitStatus[] = ['scheduled', 'completed', 'cancelled', 'no_show']

const STATUS_ICON: Record<VisitStatus, React.ReactNode> = {
  scheduled: <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />,
  completed: <Check size={12} className="text-[#34C759]" />,
  cancelled: <X size={12} className="text-destructive" />,
  no_show:   <UserX size={12} className="text-muted-foreground" />,
}

interface Props {
  visit: DailyVisit
  userRole?: string | null
  onStatusChange: (id: string, status: VisitStatus) => void
  onDelete: (id: string) => void
  onOpen: (id: string) => void
  onNoShow?: (id: string) => void
  onPayment?: (id: string) => void
  onRemind?: (id: string) => void
}

export function VisitCard({ visit, userRole, onStatusChange, onDelete, onOpen, onNoShow, onPayment, onRemind }: Props) {
  const [menuOpen, setMenuOpen]   = useState(false)
  const [menuPos, setMenuPos]     = useState<{ top: number; left: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const canRecordPayment = !!userRole && PAYMENT_ROLES.includes(userRole)
  const showPaymentItem  = canRecordPayment && visit.status === 'completed' && !visit.package_id
  const showUnpaidBadge  = visit.status === 'completed' && !visit.has_payment && !visit.package_id
  const isIncomplete     = visit.status === 'completed' && (!visit.diagnosis || !visit.treatment || !visit.regio)
  const canRemind        = !!userRole && REMIND_ROLES.includes(userRole) && isIncomplete && !!onRemind

  function openMenu(e: React.MouseEvent) {
    e.stopPropagation()
    if (!cardRef.current) return
    const rect      = cardRef.current.getBoundingClientRect()
    const menuWidth = 208
    const left      = Math.min(rect.right, window.innerWidth - menuWidth - 8)
    const top       = Math.min(rect.bottom + 4, window.innerHeight - 320)
    setMenuPos({ top, left })
    setMenuOpen(true)
  }

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
      ref={cardRef}
      className={[
        'relative rounded-lg border px-2 py-1.5 flex flex-col gap-0.5',
        'transition-all duration-150 cursor-pointer',
        menuOpen ? 'scale-[1.02]' : 'hover:scale-[1.02]',
        colorCls,
      ].join(' ')}
      onClick={openMenu}
      onContextMenu={(e) => { e.preventDefault(); openMenu(e) }}
      role="button"
      aria-haspopup="menu"
      aria-expanded={menuOpen}
    >
      {/* Patient name — click drills to medical record, does NOT open menu */}
      <div className="flex items-start gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(visit.id) }}
          className="text-[11px] font-semibold leading-tight flex-1 truncate text-left hover:underline cursor-pointer"
        >
          {visit.patient_name}
        </button>
      </div>

      {/* Time + status row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {visit.visit_time && (
          <span className="text-[9px] font-mono opacity-70">{visit.visit_time}</span>
        )}
        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${STATUS_BADGE[visit.status]}`}>
          {STATUS_LABEL[visit.status]}
        </span>

        {/* Payment badge */}
        {showUnpaidBadge && (
          <span
            className="text-[8px] px-1.5 py-0.5 rounded-full font-bold bg-[#FFB35C]/20 text-[#FFB35C] border border-[#FFB35C]/30"
            style={{ animation: 'vcBadgeIn 350ms cubic-bezier(0.34,1.56,0.64,1) forwards' }}
          >
            Belum Bayar
          </span>
        )}
        {visit.status === 'completed' && visit.has_payment && (
          <span
            className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold border ${
              visit.visit_payment_status === 'LUNAS'
                ? 'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/30'
                : 'bg-[#FFB35C]/15 text-[#FFB35C] border-[#FFB35C]/30'
            }`}
          >
            {visit.visit_payment_status ?? 'Bayar'}
          </span>
        )}

        {/* Incomplete medical record warning */}
        {isIncomplete && (
          <span
            className="text-[8px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400 border border-amber-400/30"
            title="Rekam medis belum lengkap"
          >
            Rekam Medis
          </span>
        )}
      </div>

      {/* Chief complaint preview */}
      {visit.chief_complaint && (
        <span className="text-[9px] opacity-60 truncate">{visit.chief_complaint}</span>
      )}

      {/* Context menu */}
      {menuOpen && menuPos && createPortal(
        <>
          <style>{`@keyframes vcBadgeIn { from{opacity:0;transform:scale(0.6)} to{opacity:1;transform:scale(1)} }`}</style>
          <div className="fixed inset-0 z-200" onClick={() => setMenuOpen(false)} />

          <div
            ref={menuRef}
            role="menu"
            className="dark fixed z-201 w-52 rounded-xl border border-white/15 p-1.5 shadow-2xl backdrop-blur-xl bg-gray-900/95"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <p className="text-[10px] text-muted-foreground/70 px-2.5 pt-1 pb-2 uppercase tracking-widest font-semibold">
              Ubah Status
            </p>

            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => {
                  if (s === 'no_show' && onNoShow) {
                    onNoShow(visit.id)
                  } else {
                    onStatusChange(visit.id, s)
                  }
                  setMenuOpen(false)
                }}
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

            {showPaymentItem && (
              <>
                <hr className="border-white/10 my-1.5" />
                <button
                  onClick={() => { onPayment?.(visit.id); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-[#34C759] hover:bg-[#34C759]/10 transition-colors cursor-pointer"
                  role="menuitem"
                >
                  {visit.has_payment
                    ? <BanknoteArrowUp size={13} />
                    : <CreditCard size={13} />
                  }
                  {visit.has_payment ? 'Tambah Pembayaran' : 'Catat Pembayaran'}
                </button>
              </>
            )}

            {canRemind && (
              <>
                <hr className="border-white/10 my-1.5" />
                <button
                  onClick={() => { onRemind!(visit.id); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-amber-400 hover:bg-amber-400/10 transition-colors cursor-pointer"
                  role="menuitem"
                >
                  <BellRing size={13} />
                  Ingatkan Terapis
                </button>
              </>
            )}

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
