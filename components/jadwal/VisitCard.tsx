'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useDraggable } from '@dnd-kit/core'
import { Check, X, UserX, Trash2, CreditCard, BanknoteArrowUp, BellRing, Loader2, Package, FileText, Unlink, Link2, UserCheck, UserCog, Star, QrCode } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import type { DailyVisit } from './types'
import { STATUS_COLOR, STATUS_LABEL, SERVICE_TYPE_LABEL } from './types'
import type { VisitStatus } from '@/types'
import { isRegioRequired } from '@/lib/visitRouting'

const PAYMENT_ROLES = ['finance', 'manager', 'director', 'admin']
const REMIND_ROLES  = ['admin', 'director', 'manager', 'hr']

const ALL_STATUSES: VisitStatus[] = ['scheduled', 'completed', 'cancelled', 'no_show']
// Context-menu items hidden for now — flip back to re-enable.
const MENU_HIDDEN_STATUSES: VisitStatus[] = ['scheduled', 'completed', 'cancelled']
const SHOW_MENU_OPEN_RECORD = false
const SHOW_MENU_CHANGE_THERAPIST = false

const STATUS_ICON: Record<VisitStatus, React.ReactNode> = {
  scheduled:   <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />,
  completed:   <Check size={12} className="text-[#34C759]" />,
  cancelled:   <X size={12} className="text-destructive" />,
  no_show:     <UserX size={12} className="text-muted-foreground" />,
  rescheduled: <span className="w-2 h-2 rounded-full bg-[#FFB35C] inline-block" />,
}

interface Props {
  visit: DailyVisit
  userRole?: string | null
  onStatusChange: (id: string, status: VisitStatus) => void
  onDelete: (id: string) => void
  /** Patient name click — opens the patient's profile/payment history in a new tab */
  onOpen: (id: string) => void
  /** Opens the visit's session note / medical record */
  onOpenRecord: (id: string) => void
  onPayment?: (id: string) => void
  /** Send a DOKU payment link (QRIS / VA) for this visit */
  onPayOnline?: (id: string) => void
  onRemind?: (id: string) => void
  onWhatsApp?: (id: string) => void
  onWhatsAppConfirmation?: (id: string) => void
  isRefreshing?: boolean
  onSellPackage?: (id: string) => void
  onDetachPackage?: (id: string) => void
  onAttachPackage?: (id: string) => void
  onMarkPresent?: (id: string, present: boolean) => void
  /** Opens the reassign dialog (therapist + time) — available whatever the kehadiran */
  onChangeTherapist?: (id: string) => void
}

export function VisitCard({ visit, userRole, onStatusChange, onDelete, onOpen, onOpenRecord, onPayment, onPayOnline, onRemind, onWhatsApp, onWhatsAppConfirmation, isRefreshing, onSellPackage, onDetachPackage, onAttachPackage, onMarkPresent, onChangeTherapist }: Props) {
  const [menuOpen, setMenuOpen]   = useState(false)
  const [menuPos, setMenuPos]     = useState<{ top: number; left: number } | null>(null)
  const [menuReady, setMenuReady] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const anchorRectRef = useRef<DOMRect | null>(null)

  // Therapists/staff view the schedule but don't manage it — no status changes,
  // deletes, payments, or reminders from the quick-action menu.
  const canManageVisit   = !!userRole && !['therapist', 'staff', 'sport_massage_therapist'].includes(userRole)
  const canRecordPayment = !!userRole && PAYMENT_ROLES.includes(userRole)
  const showPaymentItem  = canRecordPayment && visit.status === 'completed'
  // Online link also before the session (pay upfront) — hidden once settled.
  const showPayOnlineItem = !!onPayOnline && canRecordPayment
    && (visit.status === 'scheduled' || visit.status === 'completed')
    && (!visit.has_payment || visit.visit_payment_status === 'DP' || visit.package_payment_ok === false)
  // Fully paid: own payment settled, or a package session whose package passes its payment gate.
  const isPaid           = visit.package_id
    ? visit.package_payment_ok === true
    : visit.has_payment && (visit.visit_payment_status === 'LUNAS' || visit.visit_payment_status === 'PELUNASAN')
  const isIncomplete     = visit.status === 'completed' && (!visit.diagnosis || !visit.treatment || (isRegioRequired(visit.service_type) && !visit.regio))
  const canRemind        = !!userRole && REMIND_ROLES.includes(userRole) && isIncomplete && !!onRemind
  const canSendWhatsApp             = !!visit.patient_phone && !!onWhatsApp
  const canSendWhatsAppConfirmation = !!visit.patient_phone && !!onWhatsAppConfirmation

  // A visit scheduled against an existing package keeps its literal service_type
  // (e.g. 'SESI KLINIK') but is still a package session — package_id wins.
  const serviceTypeLabel   = visit.package_id
    ? (visit.package_name ?? 'Paket')
    : (visit.layanan_nama ?? (visit.service_type ? SERVICE_TYPE_LABEL[visit.service_type] : undefined))

  const isAssessmentVisit   = visit.service_type === 'TERAPI AWAL KLINIK' || visit.service_type === 'TERAPI AWAL VISIT'
  // Selling a package is always offered on a completed visit — including one that's
  // already part of an existing package (patients can buy ahead/renew). A fresh TA
  // assessment is the one case that must be paid for first, before upselling a package.
  const showSellPackageItem = canRecordPayment && visit.status === 'completed'
    && (isAssessmentVisit ? (visit.has_payment && visit.visit_payment_status === 'LUNAS') : true)

  // Detaching lets staff correct a mistaken package link, or bill this session
  // on its own when the patient wants to pay outside the package.
  const showDetachPackageItem = canRecordPayment && !!visit.package_id

  // Mirror of the above: a visit that wasn't booked against a package can be
  // retroactively linked to one of the patient's existing packages. TA visits
  // are excluded — they must always be billed on their own (never via a package).
  const showAttachPackageItem = canRecordPayment && !visit.package_id && !isAssessmentVisit

  // Front-desk check-in — the only place kehadiran can be set before a therapist
  // opens the SOAP/assessment form (those forms only default it on save). This
  // is the prerequisite for the RM Lock gate in the form pages themselves.
  // Stays visible after check-in too, flipped to "Tandai Tidak Hadir", so an
  // accidental press can be undone from the same spot.
  const showMarkPresentItem = canManageVisit && !!onMarkPresent
  const isMarkedPresent     = visit.kehadiran === 'HADIR'

  // Drag to another therapist column / hour row to reassign — deliberately not
  // gated on kehadiran, so a visit already marked HADIR can still be moved.
  const canMove = canManageVisit && !!onChangeTherapist && visit.status !== 'cancelled'
  const { attributes, listeners, setNodeRef: dragRef, isDragging } = useDraggable({
    id: `visit:${visit.id}`, data: { visitId: visit.id }, disabled: !canMove,
  })
  function setRefs(el: HTMLDivElement | null) { cardRef.current = el; dragRef(el) }

  function openMenu(e: React.MouseEvent) {
    e.stopPropagation()
    if (!canManageVisit) { onOpenRecord(visit.id); return }
    if (!cardRef.current) return
    anchorRectRef.current = cardRef.current.getBoundingClientRect()
    setMenuPos(null)
    setMenuReady(false)
    setMenuOpen(true)
  }

  // Position is computed from the menu's real rendered height (measured here),
  // not a guess — the item count varies a lot by role, so a fixed offset either
  // leaves a big gap or, worse, pushes items below the viewport unreachable.
  useLayoutEffect(() => {
    if (!menuOpen) { setMenuPos(null); setMenuReady(false); return }
    if (!menuRef.current || !anchorRectRef.current) return
    const rect       = anchorRectRef.current
    const menuWidth  = 208
    const menuHeight = menuRef.current.offsetHeight
    const margin = 8
    const gap    = 4

    const spaceBelow = window.innerHeight - rect.bottom - gap
    const spaceAbove = rect.top - gap
    const openUpward = menuHeight > spaceBelow && (menuHeight <= spaceAbove || spaceAbove > spaceBelow)

    let top = openUpward ? rect.top - gap - menuHeight : rect.bottom + gap
    top = Math.max(margin, Math.min(top, window.innerHeight - menuHeight - margin))

    let left = Math.min(rect.right, window.innerWidth - menuWidth - margin)
    left = Math.max(margin, left)

    setMenuPos({ top, left })
    setMenuReady(true)
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    function close() { setMenuOpen(false) }
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close()
    }
    // Scrolling the menu's own (overflow-y-auto) content must not close it —
    // only close on scroll of the page/grid behind it.
    function onScroll(e: Event) {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return
      close()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [menuOpen])

  const colorCls = STATUS_COLOR[visit.status]

  return (
    <div
      ref={setRefs}
      {...(canMove ? { ...attributes, ...listeners } : {})}
      className={[
        'relative rounded-lg border px-2 py-1.5 flex flex-col gap-0.5',
        'transition-all duration-150 cursor-pointer',
        menuOpen ? 'scale-[1.02]' : 'hover:scale-[1.02]',
        isDragging ? 'opacity-40' : '',
        colorCls,
      ].join(' ')}
      onClick={openMenu}
      onContextMenu={(e) => { e.preventDefault(); openMenu(e) }}
      role="button"
      aria-haspopup={canManageVisit ? 'menu' : undefined}
      aria-expanded={canManageVisit ? menuOpen : undefined}
    >
      {/* Refreshing indicator — a save for this visit is in flight */}
      {isRefreshing && (
        <div className="absolute top-1 right-1 z-10" title="Memperbarui...">
          <Loader2 size={11} className="animate-spin opacity-70" />
        </div>
      )}

      {/* Patient name — opens patient profile/payment history, does NOT open menu */}
      <div className="flex items-start gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(visit.id) }}
          className="text-[11px] font-semibold leading-tight flex-1 truncate text-left hover:underline cursor-pointer"
          title="Buka profil pasien"
        >
          {visit.is_priority && (
            <Star
              size={10}
              className="inline -mt-0.5 mr-1 fill-[#FFB35C] text-[#FFB35C]"
              aria-label="Pasien yang perlu diperhatikan hari ini"
            />
          )}
          {visit.patient_name}
          {visit.booking_source === 'online' && (
            <span
              className="ml-1 inline-flex items-center rounded px-1 py-px align-middle text-[8px] font-bold uppercase tracking-wide bg-chart-5/15 text-chart-5"
              title="Dipesan pasien lewat gangsehat.com"
            >
              Online
            </span>
          )}
        </button>
        {/* Roles without the quick-action menu (therapist/staff) get an explicit
            shortcut straight to the session note. */}
        {!canManageVisit && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenRecord(visit.id) }}
            className="shrink-0 p-0.5 rounded-md hover:bg-white/10 text-foreground/60 hover:text-foreground transition-colors cursor-pointer"
            title="Buka rekam medis"
          >
            <FileText size={11} />
          </button>
        )}
      </div>

      {/* Service + payment — kept minimal so overlapping cards stay readable */}
      <div className="flex items-center gap-1 min-w-0">
        {serviceTypeLabel && (
          <span className="text-[9px] opacity-80 truncate flex-1 min-w-0" title={serviceTypeLabel}>
            {serviceTypeLabel}
          </span>
        )}
        {visit.status !== 'cancelled' && (
          <span
            className={`shrink-0 text-[8px] px-1.5 py-0.5 rounded-full font-bold border ${
              isPaid
                ? 'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/30'
                : 'bg-[#FFB35C]/15 text-[#FFB35C] border-[#FFB35C]/30'
            }`}
          >
            {isPaid ? 'Lunas' : 'Belum Lunas'}
          </span>
        )}
      </div>

      {/* Context menu */}
      {menuOpen && createPortal(
        <>
          <div className="fixed inset-0 z-200" onClick={() => setMenuOpen(false)} />

          <div
            ref={menuRef}
            role="menu"
            className="dark fixed z-201 w-52 rounded-xl border border-white/15 p-1.5 shadow-2xl backdrop-blur-xl bg-gray-900/95 overflow-y-auto"
            style={{
              top: menuPos?.top ?? -9999,
              left: menuPos?.left ?? -9999,
              maxHeight: 'calc(100vh - 16px)',
              visibility: menuReady ? 'visible' : 'hidden',
            }}
          >
            <p className="text-[10px] text-muted-foreground/70 px-2.5 pt-1 pb-2 uppercase tracking-widest font-semibold">
              Ubah Status
            </p>

            {ALL_STATUSES.filter((s) => !MENU_HIDDEN_STATUSES.includes(s)).map((s) => (
              <button
                key={s}
                onClick={() => {
                  onStatusChange(visit.id, s)
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

            {SHOW_MENU_OPEN_RECORD && (
              <>
                <hr className="border-white/10 my-1.5" />
                <button
                  onClick={() => { onOpenRecord(visit.id); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-foreground/80 hover:bg-white/8 hover:text-foreground transition-colors cursor-pointer"
                  role="menuitem"
                >
                  <FileText size={13} />
                  Buka Rekam Medis
                </button>
              </>
            )}

            {showMarkPresentItem && (
              <>
                <hr className="border-white/10 my-1.5" />
                <button
                  onClick={() => { onMarkPresent?.(visit.id, !isMarkedPresent); setMenuOpen(false) }}
                  className={[
                    'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors cursor-pointer',
                    isMarkedPresent
                      ? 'text-[#FFB35C] hover:bg-[#FFB35C]/10'
                      : 'text-[#34C759] hover:bg-[#34C759]/10',
                  ].join(' ')}
                  role="menuitem"
                >
                  {isMarkedPresent ? <UserX size={13} /> : <UserCheck size={13} />}
                  {isMarkedPresent ? 'Tandai Tidak Hadir' : 'Tandai Hadir'}
                </button>
              </>
            )}

            {SHOW_MENU_CHANGE_THERAPIST && canMove && (
              <button
                onClick={() => { onChangeTherapist?.(visit.id); setMenuOpen(false) }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-foreground/80 hover:bg-white/8 hover:text-foreground transition-colors cursor-pointer"
                role="menuitem"
              >
                <UserCog size={13} />
                Ganti Terapis / Jam
              </button>
            )}

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
                  {visit.has_payment ? 'Edit Pembayaran' : 'Catat Pembayaran'}
                </button>
              </>
            )}

            {showPayOnlineItem && (
              <>
                {!showPaymentItem && <hr className="border-white/10 my-1.5" />}
                <button
                  onClick={() => { onPayOnline?.(visit.id); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                  role="menuitem"
                >
                  <QrCode size={13} />
                  Kirim Link Bayar (QRIS/VA)
                </button>
              </>
            )}

            {showDetachPackageItem && (
              <>
                <hr className="border-white/10 my-1.5" />
                <button
                  onClick={() => { onDetachPackage?.(visit.id); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-[#FFB35C] hover:bg-[#FFB35C]/10 transition-colors cursor-pointer"
                  role="menuitem"
                >
                  <Unlink size={13} />
                  Lepas dari Paket
                </button>
              </>
            )}

            {showAttachPackageItem && (
              <>
                <hr className="border-white/10 my-1.5" />
                <button
                  onClick={() => { onAttachPackage?.(visit.id); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                  role="menuitem"
                >
                  <Link2 size={13} />
                  Gunakan Paket
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

            {(canSendWhatsApp || canSendWhatsAppConfirmation) && (
              <hr className="border-white/10 my-1.5" />
            )}
            {canSendWhatsApp && (
              <button
                onClick={() => { onWhatsApp!(visit.id); setMenuOpen(false) }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-[#25D366] hover:bg-[#25D366]/10 transition-colors cursor-pointer"
                role="menuitem"
              >
                <FaWhatsapp size={13} />
                Kirim Pengingat WA
              </button>
            )}
            {canSendWhatsAppConfirmation && (
              <button
                onClick={() => { onWhatsAppConfirmation!(visit.id); setMenuOpen(false) }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-[#25D366] hover:bg-[#25D366]/10 transition-colors cursor-pointer"
                role="menuitem"
              >
                <FaWhatsapp size={13} />
                Kirim Konfirmasi WA
              </button>
            )}

            {showSellPackageItem && (
              <>
                <hr className="border-white/10 my-1.5" />
                <button
                  onClick={() => { onSellPackage?.(visit.id); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                  role="menuitem"
                >
                  <Package size={13} />
                  Jual Paket
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
