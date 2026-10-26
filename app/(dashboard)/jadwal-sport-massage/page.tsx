'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useJadwalSportMassage } from '@/hooks/useJadwalSportMassage'
import { createClient } from '@/lib/supabase/client'
import { toIso } from '@/components/jadwal/utils'
import { PageHeader } from '@/components/jadwal/PageHeader'
import { DateNav } from '@/components/jadwal/DateNav'
import { VisitSummary } from '@/components/jadwal/VisitSummary'
import { GridSkeleton } from '@/components/jadwal/GridSkeleton'
import { Legend } from '@/components/jadwal/Legend'
import { PendingLeaveModal } from '@/components/jadwal/PendingLeaveModal'
import { DailyGrid } from '@/components/jadwal/DailyGrid'
import { AssignSportMassageDialog } from '@/components/jadwal/AssignSportMassageDialog'
import { MedicalRecordModal } from '@/components/jadwal/MedicalRecordModal'
import { StaffDetailModal } from '@/components/jadwal/StaffDetailModal'
import { ControlsBar } from '@/components/jadwal/ControlsBar'
import { FocusModeBar } from '@/components/jadwal/FocusModeBar'
import { PaymentDialog } from '@/components/visits/PaymentDialog'
import { ChangeTherapistDialog } from '@/components/jadwal/ChangeTherapistDialog'
import { PayOnlineFlow } from '@/components/payment-links/PayOnlineFlow'
import { SportMassageExportDialog } from '@/components/sport-massage/SportMassageExportDialog'
import { FileDown } from 'lucide-react'
import { sendMedicalRecordReminder, updateVisit } from '@/app/actions/jadwal'
import { useVisitWhatsApp } from '@/hooks/useVisitWhatsApp'
import { useToast } from '@/context/ToastContext'
import type { AssignTarget, RefreshingCell } from '@/components/jadwal/types'
import type { DailyVisit } from '@/app/actions/jadwal'
import type { ShiftFilter } from '@/lib/shifts'

const LS_KEY = 'jadwal_sm_showInactive'
const LS_SHIFT_KEY = 'jadwal_sm_shiftFilter'

export default function JadwalSportMassagePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    today, selectedDate, setSelectedDate,
    staff, visits, loading,
    leavePopover, setLeavePopover,
    leaveSaving, canApproveLeave,
    userRole,
    gridStart, gridEnd, slotHours,
    branches, selectedBranchId, setSelectedBranchId,
    loadAll, handleStatusChange, handleDelete, handleMoveVisit, handleLeaveAction,
  } = useJadwalSportMassage()
  const { showToast } = useToast()
  // Same WhatsApp reminder / confirmation (template + order ID) as fisioterapi
  const { handleWhatsAppReminder, handleWhatsAppConfirmation } = useVisitWhatsApp(visits, staff, branches)

  // Branch-flag gate: does the selected branch have sport massage enabled?
  const [branchEnabled, setBranchEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    if (selectedBranchId === undefined) return
    if (!selectedBranchId) { setBranchEnabled(true); return } // director w/ no branch selected — don't block
    let cancelled = false
    createClient()
      .from('branch_sport_massage_settings')
      .select('enabled')
      .eq('branch_id', selectedBranchId)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setBranchEnabled(data?.enabled ?? false) })
    return () => { cancelled = true }
  }, [selectedBranchId])

  const isDirector = userRole === 'director'

  // Modal / dialog state
  const [assignTarget, setAssignTarget]             = useState<AssignTarget | null>(null)
  const [selectedVisitId, setSelectedVisitId]       = useState<string | null>(null)
  const [selectedVisitShift, setSelectedVisitShift] = useState<string | null>(null)
  const [selectedStaffId, setSelectedStaffId]       = useState<string | null>(null)
  const [paymentVisit, setPaymentVisit]             = useState<DailyVisit | null>(null)
  const [refreshingCell, setRefreshingCell]         = useState<RefreshingCell | null>(null)
  const [payOnlineVisit, setPayOnlineVisit]         = useState<DailyVisit | null>(null)
  const [changeTherapistVisit, setChangeTherapistVisit] = useState<DailyVisit | null>(null)
  const [exportOpen, setExportOpen]                 = useState(false)

  useEffect(() => {
    const dateParam = searchParams.get('date')
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setSelectedDate(new Date(dateParam + 'T00:00:00'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function silentReload(cell: RefreshingCell | null) {
    setRefreshingCell(cell)
    await loadAll(selectedDate, { silent: true })
    setRefreshingCell(null)
  }

  const [showInactive, setShowInactive] = useState(false)
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all')
  const [sortOrder, setSortOrder]       = useState<'asc' | 'desc'>('asc')
  const [isFocused, setIsFocused]       = useState(true)
  const [shiftFilter, setShiftFilter]   = useState<ShiftFilter>('all')

  useEffect(() => {
    setShowInactive(localStorage.getItem(LS_KEY) === 'true')
    const v = localStorage.getItem(LS_SHIFT_KEY)
    // A stored 'middle' (removed view) falls back to 'all'.
    if (v === 'pagi' || v === 'sore') setShiftFilter(v)
  }, [])

  function handleSetShiftFilter(v: ShiftFilter) {
    setShiftFilter(v)
    localStorage.setItem(LS_SHIFT_KEY, v)
  }

  useEffect(() => {
    if (!isFocused) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFocused(false) }
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('keydown', handleKey) }
  }, [isFocused])

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

  function handleOpenPayment(visitId: string) {
    setPaymentVisit(visits.find((v) => v.id === visitId) ?? null)
  }

  const canSendReminders = !!userRole && ['admin', 'director', 'manager', 'hr'].includes(userRole)

  async function handleRemind(visitId: string) {
    const result = await sendMedicalRecordReminder(visitId)
    if (result.alreadySent) showToast('Pengingat sudah dikirim hari ini', 'info')
    else if (result.error) showToast(result.error, 'error')
    else showToast('Pengingat terkirim ke terapis', 'success')
  }

  async function handleMarkPresent(visitId: string, present: boolean) {
    await updateVisit(visitId, present
      ? { kehadiran: 'HADIR', status: 'completed' }
      : { kehadiran: 'TIDAK HADIR', status: 'scheduled' })
    silentReload({ type: 'visit', visitId })
  }

  const sharedBarProps = {
    genderFilter, setGenderFilter,
    sortOrder, setSortOrder,
    showInactive, toggleShowInactive,
    inactiveStaff,
    shiftFilter, setShiftFilter: handleSetShiftFilter,
  }

  const gateBlocked = branchEnabled === false && !isDirector

  return (
    <>
      <div className={`j-fade-in ${isFocused ? '' : 'space-y-5'}`}>

        {!isFocused && (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <PageHeader
                date={selectedDate}
                loading={loading}
                onRefresh={() => loadAll(selectedDate)}
              />
              <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
                {branches.length > 0 && (
                  <select
                    value={selectedBranchId ?? ''}
                    onChange={(e) => setSelectedBranchId(e.target.value || null)}
                    className="w-full sm:w-auto sm:max-w-xs min-w-0 px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                )}
                {!gateBlocked && (
                  <button
                    onClick={() => setExportOpen(true)}
                    title="Export Excel"
                    aria-label="Export Excel"
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
                  >
                    <FileDown size={15} />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                )}
              </div>
            </div>

            <DateNav
              selectedDate={selectedDate}
              today={today}
              onSelect={setSelectedDate}
            />

            {!loading && !gateBlocked && <VisitSummary visits={visits} staff={staff} />}
          </>
        )}

        {gateBlocked ? (
          <div className="glass-card p-8 text-center text-sm text-muted-foreground">
            Sport Massage belum diaktifkan untuk cabang ini.
          </div>
        ) : (
          <>
            {!loading && !isFocused && (
              <ControlsBar
                {...sharedBarProps}
                baseStaff={baseStaff}
                visibleStaff={visibleStaff}
                onFocus={() => setIsFocused(true)}
              />
            )}

            <div
              className="glass-card overflow-hidden"
              style={isFocused
                ? { display: 'grid', gridTemplateRows: 'auto 1fr', height: 'calc(100vh - 4rem)', minHeight: '400px' }
                : { height: 'calc(100vh - 22rem)', minHeight: '400px' }
              }
            >
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
                  canCreateOrder={false}
                  orderNewHref="/order/new"
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
                    gridStart={gridStart}
                    gridEnd={gridEnd}
                    slotHours={slotHours}
                    shiftFilter={shiftFilter}
                    onAssign={setAssignTarget}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                    onOpen={(id) => {
                      const v = visits.find((x) => x.id === id)
                      if (v) window.open(`/patients/${v.patient_id}/visits`, '_blank', 'noopener,noreferrer')
                    }}
                    onOpenRecord={(id, shift) => {
                      setSelectedVisitId(id); setSelectedVisitShift(shift ?? null)
                    }}
                    onPendingLeaveClick={(staffName, leave) => setLeavePopover({ staffName, leave })}
                    onStaffClick={setSelectedStaffId}
                    onPayment={handleOpenPayment}
                    onPayOnline={(id) => setPayOnlineVisit(visits.find((v) => v.id === id) ?? null)}
                    onRemind={canSendReminders ? handleRemind : undefined}
                    onWhatsApp={handleWhatsAppReminder}
                    onWhatsAppConfirmation={handleWhatsAppConfirmation}
                    refreshingCell={refreshingCell}
                    onMarkPresent={handleMarkPresent}
                    onChangeTherapist={(id) => setChangeTherapistVisit(visits.find((v) => v.id === id) ?? null)}
                  />
                )}
              </div>
            </div>

            {!isFocused && <Legend />}
          </>
        )}
      </div>

      {/* Dialogs & modals */}
      {assignTarget && (
        <AssignSportMassageDialog
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
        onSaved={() => {
          const visitId = selectedVisitId
          setSelectedVisitId(null)
          setSelectedVisitShift(null)
          if (visitId) silentReload({ type: 'visit', visitId })
        }}
      />

      {selectedStaffId && (
        <StaffDetailModal
          staffId={selectedStaffId}
          entry={staff.find((s) => s.staff_id === selectedStaffId)!}
          onClose={() => setSelectedStaffId(null)}
          onSaved={() => silentReload({ type: 'staff', staffId: selectedStaffId })}
        />
      )}

      {payOnlineVisit && (
        <PayOnlineFlow
          target={{ visitId: payOnlineVisit.id, patientId: payOnlineVisit.patient_id, patientName: payOnlineVisit.patient_name }}
          onClose={() => setPayOnlineVisit(null)}
          onChange={(l) => {
            if (l.status === 'paid') silentReload({ type: 'visit', visitId: payOnlineVisit.id })
          }}
        />
      )}

      {exportOpen && (
        <SportMassageExportDialog
          branchId={selectedBranchId ?? null}
          branchName={branches.find((b) => b.id === selectedBranchId)?.name ?? ''}
          initialDate={selectedDate}
          onClose={() => setExportOpen(false)}
        />
      )}

      {changeTherapistVisit && (
        <ChangeTherapistDialog
          visit={changeTherapistVisit}
          staff={staff}
          onClose={() => setChangeTherapistVisit(null)}
          onSave={async (staffId, visitTime) => {
            const visitId = changeTherapistVisit.id
            const result  = await handleMoveVisit(visitId, { staffId, visitTime })
            if (!result.error) {
              showToast('Terapis diubah', 'success')
              silentReload({ type: 'visit', visitId })
            }
            return result
          }}
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
            layanan_id:           paymentVisit.layanan_id,
            attending_staff_name: staff.find((s) => s.staff_id === paymentVisit.attending_staff_id)?.nickname
              || staff.find((s) => s.staff_id === paymentVisit.attending_staff_id)?.full_name
              || undefined,
          }}
          existingTransaction={paymentVisit.visit_transaction}
          onClose={() => setPaymentVisit(null)}
          onSuccess={() => {
            const visitId = paymentVisit.id
            setPaymentVisit(null)
            silentReload({ type: 'visit', visitId })
          }}
        />
      )}
    </>
  )
}
