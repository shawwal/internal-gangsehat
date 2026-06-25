'use client'

import { useState, useEffect } from 'react'
import { useJadwalHarian } from '@/hooks/useJadwalHarian'
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
import type { AssignTarget } from '@/components/jadwal/types'
import type { DailyVisit } from '@/app/actions/jadwal'

const LS_KEY = 'jadwal_showInactive'

export default function JadwalHarianPage() {
  const {
    today, selectedDate, setSelectedDate,
    staff, visits, loading,
    leavePopover, setLeavePopover,
    leaveSaving, canApproveLeave,
    userRole,
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

  // Toolbar state
  const [showInactive, setShowInactive] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(LS_KEY) === 'true'
  })
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all')
  const [sortOrder, setSortOrder]       = useState<'asc' | 'desc'>('asc')
  const [isFocused, setIsFocused]       = useState(true)

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

  const sharedBarProps = {
    genderFilter, setGenderFilter,
    sortOrder, setSortOrder,
    showInactive, toggleShowInactive,
    inactiveStaff,
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

            <DateNav
              selectedDate={selectedDate}
              today={today}
              onSelect={setSelectedDate}
            />

            {!loading && <VisitSummary visits={visits} staff={staff} />}
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
                onAssign={setAssignTarget}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onOpen={(id, shift) => { setSelectedVisitId(id); setSelectedVisitShift(shift ?? null) }}
                onPendingLeaveClick={(staffName, leave) => setLeavePopover({ staffName, leave })}
                onStaffClick={setSelectedStaffId}
                onNoShow={handleNoShow}
                onPayment={handleOpenPayment}
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
          onSaved={() => { setAssignTarget(null); loadAll(selectedDate) }}
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
        onSaved={() => { setSelectedVisitId(null); setSelectedVisitShift(null); loadAll(selectedDate) }}
      />

      {noShowVisit && (
        <NoShowDialog
          visit={noShowVisit}
          onClose={() => setNoShowVisit(null)}
          onSaved={() => { setNoShowVisit(null); loadAll(selectedDate) }}
        />
      )}

      {selectedStaffId && (
        <StaffDetailModal
          staffId={selectedStaffId}
          entry={staff.find((s) => s.staff_id === selectedStaffId)!}
          onClose={() => setSelectedStaffId(null)}
          onSaved={() => loadAll(selectedDate)}
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
          onSuccess={() => loadAll(selectedDate)}
        />
      )}
    </>
  )
}
