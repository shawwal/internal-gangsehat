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
import { updateVisit } from '@/app/actions/jadwal'
import type { AssignTarget, RefreshingCell } from '@/components/jadwal/types'
import type { DailyVisit } from '@/app/actions/jadwal'

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
    soreDividerHour, gridStart, gridEnd,
    branches, selectedBranchId, setSelectedBranchId,
    loadAll, handleStatusChange, handleDelete, handleLeaveAction,
  } = useJadwalSportMassage()

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
                    soreDividerHour={soreDividerHour}
                    gridStart={gridStart}
                    gridEnd={gridEnd}
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
                    refreshingCell={refreshingCell}
                    onMarkPresent={handleMarkPresent}
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
