'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, BellRing, Plus } from 'lucide-react'
import { useJadwalHarian } from '@/hooks/useJadwalHarian'
import { useToast } from '@/context/ToastContext'
import { toIso } from '@/components/jadwal/utils'
import { PageHeader } from '@/components/jadwal/PageHeader'
import { DateNav } from '@/components/jadwal/DateNav'
import { VisitSummary } from '@/components/jadwal/VisitSummary'
import { GridSkeleton } from '@/components/jadwal/GridSkeleton'
import { Legend } from '@/components/jadwal/Legend'
import { PendingLeaveModal } from '@/components/jadwal/PendingLeaveModal'
import { DailyGrid } from '@/components/jadwal/DailyGrid'
import { AssignDialog } from '@/components/jadwal/AssignDialog'
import { MedicalRecordModal } from '@/components/jadwal/MedicalRecordModal'
import { StaffDetailModal } from '@/components/jadwal/StaffDetailModal'
import { NoShowDialog } from '@/components/jadwal/NoShowDialog'
import { ControlsBar } from '@/components/jadwal/ControlsBar'
import { FocusModeBar } from '@/components/jadwal/FocusModeBar'
import { PaymentDialog } from '@/components/visits/PaymentDialog'
import { PostAssessmentPackageDialog } from '@/components/visits/PostAssessmentPackageDialog'
import { sendMedicalRecordReminder, sendBulkMedicalRecordReminders } from '@/app/actions/jadwal'
import { fetchReminderTemplate } from '@/app/actions/reminder-template'
import { getVisitFormRoute } from '@/lib/visitRouting'
import { fillTemplate, formatDate, formatWaNumber } from '@/lib/utils'
import type { AssignTarget, RefreshingCell } from '@/components/jadwal/types'
import type { DailyVisit } from '@/app/actions/jadwal'
import type { MedicalRecordSavedContext } from '@/components/jadwal/MedicalRecordModal'

const REMIND_ROLES = ['admin', 'director', 'manager']

const LS_KEY = 'jadwal_showInactive'
const LS_SHIFT_KEY = 'jadwal_shiftFilter'

export default function JadwalHarianPage() {
  const router = useRouter()
  const {
    today, selectedDate, setSelectedDate,
    staff, visits, loading,
    leavePopover, setLeavePopover,
    leaveSaving, canApproveLeave,
    userRole,
    soreDividerHour, gridStart, gridEnd,
    branches, selectedBranchId, setSelectedBranchId,
    loadAll, handleStatusChange, handleDelete, handleLeaveAction,
  } = useJadwalHarian()

  // Modal / dialog state
  const [assignTarget, setAssignTarget]             = useState<AssignTarget | null>(null)
  const [selectedVisitId, setSelectedVisitId]       = useState<string | null>(null)
  const [selectedVisitShift, setSelectedVisitShift] = useState<string | null>(null)
  const [selectedStaffId, setSelectedStaffId]       = useState<string | null>(null)
  const [noShowVisit, setNoShowVisit]               = useState<DailyVisit | null>(null)
  const [paymentVisit, setPaymentVisit]             = useState<DailyVisit | null>(null)
  const [packagePrompt, setPackagePrompt]           = useState<
    (MedicalRecordSavedContext & { patientName: string; branchId: string | null }) | null
  >(null)
  const [refreshingCell, setRefreshingCell]         = useState<RefreshingCell | null>(null)

  // Reload data in place (no full-grid skeleton), flashing a spinner only on `cell`.
  async function silentReload(cell: RefreshingCell | null) {
    setRefreshingCell(cell)
    await loadAll(selectedDate, { silent: true })
    setRefreshingCell(null)
  }

  // Remind state
  const [remindLoading, setRemindLoading]   = useState<Set<string>>(new Set())
  const [remindAllLoading, setRemindAllLoading] = useState(false)
  const { showToast } = useToast()

  // WhatsApp reminder template — loaded once
  const [reminderTemplate, setReminderTemplate] = useState<string | null>(null)
  useEffect(() => {
    fetchReminderTemplate().then(setReminderTemplate)
  }, [])

  // Toolbar state — start with the SSR-safe default; the real localStorage
  // value is applied post-mount below so the client's first render still
  // matches the server-rendered HTML (avoids a hydration mismatch).
  const [showInactive, setShowInactive] = useState(false)
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all')
  const [sortOrder, setSortOrder]       = useState<'asc' | 'desc'>('asc')
  const [isFocused, setIsFocused]       = useState(true)
  const [shiftFilter, setShiftFilter]   = useState<'all' | 'pagi' | 'sore'>('all')

  useEffect(() => {
    setShowInactive(localStorage.getItem(LS_KEY) === 'true')
    const v = localStorage.getItem(LS_SHIFT_KEY)
    if (v === 'pagi' || v === 'sore') setShiftFilter(v)
  }, [])

  function handleSetShiftFilter(v: 'all' | 'pagi' | 'sore') {
    setShiftFilter(v)
    localStorage.setItem(LS_SHIFT_KEY, v)
  }

  // Escape key exits focus mode
  useEffect(() => {
    if (!isFocused) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFocused(false) }
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('keydown', handleKey) }
  }, [isFocused])

  // Derived staff lists
  const activeStaff   = staff.filter((s) => s.hasSchedule && !s.isOnLeave)
  const inactiveStaff = staff.filter((s) => !s.hasSchedule || s.isOnLeave)
  const baseStaff     = showInactive ? staff : activeStaff
  const filteredStaff = genderFilter === 'all'
    ? baseStaff
    : baseStaff.filter((s) => s.gender === genderFilter)
  const visibleStaff  = [...filteredStaff].sort((a, b) => {
    const nameA = (a.nickname?.trim() || a.full_name).toLowerCase()
    const nameB = (b.nickname?.trim() || b.full_name).toLowerCase()
    const cmp   = nameA.localeCompare(nameB, 'id')
    return sortOrder === 'asc' ? cmp : -cmp
  })

  function toggleShowInactive() {
    const next = !showInactive
    setShowInactive(next)
    localStorage.setItem(LS_KEY, String(next))
  }

  function handleNoShow(visitId: string) {
    setNoShowVisit(visits.find((v) => v.id === visitId) ?? null)
  }

  function handleOpenPayment(visitId: string) {
    setPaymentVisit(visits.find((v) => v.id === visitId) ?? null)
  }

  // Incomplete visits: completed but missing diagnosis/treatment/regio and has a therapist
  const incompleteVisits = visits.filter((v) =>
    v.status === 'completed' &&
    (!v.diagnosis || !v.treatment || !v.regio) &&
    !!v.attending_staff_id,
  )
  const canSendReminders = !!userRole && REMIND_ROLES.includes(userRole)
  const canCreateOrder = !!userRole && userRole !== 'therapist' && userRole !== 'staff'
  const orderNewHref = userRole === 'director' ? '/director/orders/new' : '/order/new'

  async function handleRemind(visitId: string) {
    setRemindLoading((prev) => new Set(prev).add(visitId))
    try {
      const result = await sendMedicalRecordReminder(visitId)
      if (result.alreadySent) {
        showToast('Pengingat sudah dikirim hari ini', 'info')
      } else if (result.error) {
        showToast(result.error, 'error')
      } else {
        showToast('Pengingat terkirim ke terapis', 'success')
      }
    } finally {
      setRemindLoading((prev) => { const s = new Set(prev); s.delete(visitId); return s })
    }
  }

  function handleWhatsAppReminder(visitId: string) {
    const visit = visits.find((v) => v.id === visitId)
    if (!visit || !visit.patient_phone) return

    const branchName    = branches.find((b) => b.id === visit.branch_id)?.name ?? ''
    const attendingStaff = staff.find((s) => s.staff_id === visit.attending_staff_id)
    const therapistName = attendingStaff?.nickname || attendingStaff?.full_name || ''

    const msg = fillTemplate(reminderTemplate ?? '', {
      nama:     visit.patient_name,
      tanggal:  formatDate(visit.visit_date),
      jam:      visit.visit_time ?? '',
      layanan:  visit.service_type ?? '',
      cabang:   branchName,
      terapis:  therapistName,
    })

    const num = formatWaNumber(visit.patient_phone)
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  async function handleRemindAll() {
    if (incompleteVisits.length === 0) return
    setRemindAllLoading(true)
    try {
      const result = await sendBulkMedicalRecordReminders(incompleteVisits.map((v) => v.id))
      if (result.error) {
        showToast(result.error, 'error')
      } else if (result.sent === 0 && result.skipped > 0) {
        showToast(`Semua pengingat sudah dikirim hari ini (${result.skipped} terapis)`, 'info')
      } else {
        const parts: string[] = []
        if (result.sent > 0) parts.push(`${result.sent} terkirim`)
        if (result.skipped > 0) parts.push(`${result.skipped} sudah dikirim`)
        showToast(`Pengingat rekam medis: ${parts.join(', ')}`, 'success')
      }
    } finally {
      setRemindAllLoading(false)
    }
  }

  function handleSellPackage(visitId: string) {
    const visit = visits.find((v) => v.id === visitId)
    if (!visit) return
    setPackagePrompt({
      patient_id:   visit.patient_id,
      service_type: visit.service_type ?? '',
      status:       'completed',
      patientName:  visit.patient_name,
      branchId:     visit.branch_id,
    })
  }

  const sharedBarProps = {
    genderFilter, setGenderFilter,
    sortOrder, setSortOrder,
    showInactive, toggleShowInactive,
    inactiveStaff,
    shiftFilter, setShiftFilter: handleSetShiftFilter,
  }

  return (
    <>
      <div className={`j-fade-in ${isFocused ? '' : 'space-y-5'}`}>

        {/* Normal mode header */}
        {!isFocused && (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <PageHeader
                date={selectedDate}
                loading={loading}
                onRefresh={() => loadAll(selectedDate)}
              />
              <div className="flex items-center gap-2">
                {branches.length > 0 && (
                  <select
                    value={selectedBranchId ?? ''}
                    onChange={(e) => setSelectedBranchId(e.target.value || null)}
                    className="px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                )}
                {canCreateOrder && (
                  <a
                    href={orderNewHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
                  >
                    <Plus size={14} /> Tambah Order
                  </a>
                )}
              </div>
            </div>

            <DateNav
              selectedDate={selectedDate}
              today={today}
              onSelect={setSelectedDate}
            />

            {!loading && <VisitSummary visits={visits} staff={staff} />}

            {/* Incomplete medical record reminder banner */}
            {!loading && canSendReminders && incompleteVisits.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-amber-400/30 bg-amber-500/10 text-amber-300 text-sm">
                <AlertTriangle size={15} className="shrink-0" />
                <span className="flex-1">
                  <span className="font-semibold">{incompleteVisits.length}</span>
                  {' '}kunjungan selesai belum ada rekam medis lengkap
                </span>
                <button
                  onClick={handleRemindAll}
                  disabled={remindAllLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-300 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                >
                  <BellRing size={12} />
                  {remindAllLoading ? 'Mengirim...' : 'Ingatkan Semua'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Controls toolbar (normal mode only) */}
        {!loading && !isFocused && (
          <ControlsBar
            {...sharedBarProps}
            baseStaff={baseStaff}
            visibleStaff={visibleStaff}
            onFocus={() => setIsFocused(true)}
          />
        )}

        {/* Main grid card */}
        <div
          className="glass-card overflow-hidden"
          style={isFocused
            ? { display: 'grid', gridTemplateRows: 'auto 1fr', height: 'calc(100vh - 4rem)', minHeight: '400px' }
            : { height: 'calc(100vh - 22rem)', minHeight: '400px' }
          }
        >
          {/* Compact topbar — focus mode only */}
          {isFocused && (
            <FocusModeBar
              {...sharedBarProps}
              branches={branches}
              selectedBranchId={selectedBranchId ?? null}
              setSelectedBranchId={setSelectedBranchId}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              today={today}
              onExit={() => setIsFocused(false)}
              canCreateOrder={canCreateOrder}
              orderNewHref={orderNewHref}
            />
          )}

          <div className={isFocused ? 'min-h-0 overflow-hidden' : 'h-full'}>
            {loading ? (
              <GridSkeleton />
            ) : (
              <DailyGrid
                staff={visibleStaff}
                visits={visits}
                date={toIso(selectedDate)}
                userRole={userRole}
                soreDividerHour={soreDividerHour}
                gridStart={gridStart}
                gridEnd={gridEnd}
                shiftFilter={shiftFilter}
                onAssign={setAssignTarget}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onOpen={(id, shift) => {
                  const v = visits.find((x) => x.id === id)
                  const route = getVisitFormRoute(v?.service_type)
                  if (route) {
                    router.push(`/visits/${id}/${route}?from=/jadwal-harian`)
                    return
                  }
                  setSelectedVisitId(id); setSelectedVisitShift(shift ?? null)
                }}
                onPendingLeaveClick={(staffName, leave) => setLeavePopover({ staffName, leave })}
                onStaffClick={setSelectedStaffId}
                onNoShow={handleNoShow}
                onPayment={handleOpenPayment}
                onRemind={canSendReminders ? handleRemind : undefined}
                onWhatsApp={handleWhatsAppReminder}
                refreshingCell={refreshingCell}
                onSellPackage={handleSellPackage}
              />
            )}
          </div>
        </div>

        {!isFocused && <Legend />}
      </div>

      {/* Dialogs & modals */}
      {assignTarget && (
        <AssignDialog
          target={assignTarget}
          onClose={() => setAssignTarget(null)}
          onSaved={() => {
            const { staffId, hour } = assignTarget
            setAssignTarget(null)
            silentReload({ type: 'cell', staffId, hour })
          }}
        />
      )}

      {leavePopover && (
        <PendingLeaveModal
          state={leavePopover}
          canApprove={canApproveLeave}
          saving={leaveSaving}
          onClose={() => setLeavePopover(null)}
          onAction={handleLeaveAction}
        />
      )}

      <MedicalRecordModal
        visitId={selectedVisitId}
        contextShift={selectedVisitShift}
        contextServiceType={visits.find((v) => v.id === selectedVisitId)?.service_type ?? null}
        contextKehadiran={
          visits.find((v) => v.id === selectedVisitId)?.status === 'completed' ? 'HADIR'
          : visits.find((v) => v.id === selectedVisitId)?.status === 'no_show' ? 'TIDAK HADIR'
          : null
        }
        onClose={() => { setSelectedVisitId(null); setSelectedVisitShift(null) }}
        onSaved={(ctx) => {
          const visit = visits.find((v) => v.id === selectedVisitId)
          const visitId = selectedVisitId
          setSelectedVisitId(null)
          setSelectedVisitShift(null)
          const route = getVisitFormRoute(ctx?.service_type)
          if (route) {
            if (visitId) router.push(`/visits/${visitId}/${route}?from=/jadwal-harian`)
            return
          }
          if (visitId) silentReload({ type: 'visit', visitId })
          if (ctx?.status === 'completed' && ctx.service_type === 'TA VISIT') {
            setPackagePrompt({ ...ctx, patientName: visit?.patient_name ?? '', branchId: visit?.branch_id ?? null })
          }
        }}
      />

      {noShowVisit && (
        <NoShowDialog
          visit={noShowVisit}
          onClose={() => setNoShowVisit(null)}
          onSaved={() => {
            const visitId = noShowVisit.id
            setNoShowVisit(null)
            silentReload({ type: 'visit', visitId })
          }}
        />
      )}

      {selectedStaffId && (
        <StaffDetailModal
          staffId={selectedStaffId}
          entry={staff.find((s) => s.staff_id === selectedStaffId)!}
          onClose={() => setSelectedStaffId(null)}
          onSaved={() => silentReload({ type: 'staff', staffId: selectedStaffId })}
        />
      )}

      {paymentVisit && (
        <PaymentDialog
          visit={{
            id:                   paymentVisit.id,
            patient_id:           paymentVisit.patient_id,
            patient_name:         paymentVisit.patient_name,
            visit_date:           paymentVisit.visit_date,
            service_type:         paymentVisit.service_type,
            branch_id:            paymentVisit.branch_id,
            attending_staff_name: staff.find((s) => s.staff_id === paymentVisit.attending_staff_id)?.nickname
              || staff.find((s) => s.staff_id === paymentVisit.attending_staff_id)?.full_name
              || undefined,
          }}
          onClose={() => setPaymentVisit(null)}
          onSuccess={() => {
            const visitId = paymentVisit.id
            setPaymentVisit(null)
            silentReload({ type: 'visit', visitId })
          }}
        />
      )}

      {packagePrompt && (
        <PostAssessmentPackageDialog
          patientId={packagePrompt.patient_id}
          patientName={packagePrompt.patientName}
          branchId={packagePrompt.branchId}
          sourceServiceType={packagePrompt.service_type}
          onClose={() => setPackagePrompt(null)}
          onSuccess={() => { setPackagePrompt(null); silentReload(null) }}
        />
      )}

    </>
  )
}
