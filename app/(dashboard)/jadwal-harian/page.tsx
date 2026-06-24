'use client'

import { useState, useEffect } from 'react'
import { Users, User, ArrowUpAZ, ArrowDownAZ, Maximize2, Minimize2 } from 'lucide-react'
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

  const [assignTarget, setAssignTarget]       = useState<AssignTarget | null>(null)
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [noShowVisit, setNoShowVisit]         = useState<DailyVisit | null>(null)
  const [paymentVisit, setPaymentVisit]       = useState<DailyVisit | null>(null)

  function handleNoShow(visitId: string) {
    const visit = visits.find((v) => v.id === visitId) ?? null
    setNoShowVisit(visit)
  }

  function handleOpenPayment(visitId: string) {
    const visit = visits.find((v) => v.id === visitId) ?? null
    setPaymentVisit(visit)
  }

  const [showInactive, setShowInactive] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(LS_KEY) === 'true'
  })
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all')
  const [sortOrder, setSortOrder]       = useState<'asc' | 'desc'>('asc')
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!isFullscreen) return
    document.body.style.overflow = 'hidden'
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullscreen(false) }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKey)
    }
  }, [isFullscreen])

  function toggleShowInactive() {
    const next = !showInactive
    setShowInactive(next)
    localStorage.setItem(LS_KEY, String(next))
  }

  const activeStaff   = staff.filter((s) => s.hasSchedule && !s.isOnLeave)
  const inactiveStaff = staff.filter((s) => !s.hasSchedule || s.isOnLeave)
  const baseStaff     = showInactive ? staff : activeStaff
  const filteredStaff = genderFilter === 'all'
    ? baseStaff
    : baseStaff.filter((s) => s.gender === genderFilter)

  const visibleStaff = [...filteredStaff].sort((a, b) => {
    const nameA = (a.nickname?.trim() || a.full_name).toLowerCase()
    const nameB = (b.nickname?.trim() || b.full_name).toLowerCase()
    const cmp   = nameA.localeCompare(nameB, 'id')
    return sortOrder === 'asc' ? cmp : -cmp
  })

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes jFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .j-fade-in { animation: jFadeIn 200ms ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .j-fade-in { animation: none; }
        }
      ` }} />

      <div className="space-y-5 j-fade-in">

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

        {/* Controls toolbar */}
        {!loading && (
          <div className="flex items-center gap-3 flex-wrap">
            {/* Gender filter pills */}
            <div className="flex items-center bg-muted/40 rounded-2xl p-1 gap-0.5">
              {([
                { value: 'all',    label: 'Semua',  icon: <Users size={13} /> },
                { value: 'male',   label: 'Pria',   icon: <User  size={13} /> },
                { value: 'female', label: 'Wanita', icon: <User  size={13} /> },
              ] as const).map(({ value, label, icon }) => (
                <button
                  key={value}
                  onClick={() => setGenderFilter(value)}
                  aria-pressed={genderFilter === value}
                  className={[
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer',
                    genderFilter === value
                      ? value === 'male'
                        ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/30'
                        : value === 'female'
                        ? 'bg-[#FF0090] text-white shadow-sm shadow-primary/30'
                        : 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/10',
                  ].join(' ')}
                >
                  {icon}
                  {label}
                  {genderFilter !== value && (
                    <span className="text-[10px] opacity-60">
                      {value === 'all'
                        ? baseStaff.length
                        : baseStaff.filter((s) => s.gender === value).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {genderFilter !== 'all' && (
              <span className="text-xs text-muted-foreground">
                {visibleStaff.length} terapis
              </span>
            )}

            {/* View controls: sort + inactive toggle */}
            <div className="ml-auto flex items-center gap-0.5 bg-muted/40 rounded-2xl p-1">
              <button
                onClick={() => setSortOrder((o) => o === 'asc' ? 'desc' : 'asc')}
                title={sortOrder === 'asc' ? 'Urutan A→Z' : 'Urutan Z→A'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-150 cursor-pointer"
              >
                {sortOrder === 'asc' ? <ArrowUpAZ size={13} /> : <ArrowDownAZ size={13} />}
                Nama
              </button>

              {inactiveStaff.length > 0 && (
                <>
                  <div className="w-px h-4 bg-border/60 mx-0.5" />
                  <button
                    onClick={toggleShowInactive}
                    aria-pressed={showInactive}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-150 cursor-pointer"
                  >
                    <span className="select-none">Nonaktif ({inactiveStaff.length})</span>
                    <span
                      className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                        showInactive ? 'bg-primary' : 'bg-muted-foreground/40'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                          showInactive ? 'translate-x-3' : 'translate-x-0'
                        }`}
                      />
                    </span>
                  </button>
                </>
              )}

              <div className="w-px h-4 bg-border/60 mx-0.5" />
              {/* <button
                onClick={() => setIsFullscreen(true)}
                title="Layar penuh"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-150 cursor-pointer"
              >
                <Maximize2 size={13} />
                Penuh
              </button> */}
            </div>
          </div>
        )}

        <div
          className={isFullscreen
            ? 'fixed inset-0 z-50 bg-background'
            : 'glass-card overflow-hidden'
          }
          style={isFullscreen
            ? { display: 'grid', gridTemplateRows: 'auto 1fr' }
            : { height: 'calc(100vh - 22rem)', minHeight: '400px' }
          }
        >
          {/* Compact topbar shown only in fullscreen */}
          {isFullscreen && (
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border flex-wrap bg-background/95 backdrop-blur-sm">
              {branches.length > 0 && (
                <select
                  value={selectedBranchId ?? ''}
                  onChange={(e) => setSelectedBranchId(e.target.value || null)}
                  className="px-3 py-1.5 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
              <DateNav selectedDate={selectedDate} today={today} onSelect={setSelectedDate} />

              <div className="ml-auto flex items-center gap-3">
                {/* Gender filter */}
                <div className="flex items-center bg-muted/40 rounded-2xl p-1 gap-0.5">
                  {([
                    { value: 'all',    label: 'Semua',  icon: <Users size={13} /> },
                    { value: 'male',   label: 'Pria',   icon: <User  size={13} /> },
                    { value: 'female', label: 'Wanita', icon: <User  size={13} /> },
                  ] as const).map(({ value, label, icon }) => (
                    <button
                      key={value}
                      onClick={() => setGenderFilter(value)}
                      aria-pressed={genderFilter === value}
                      className={[
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer',
                        genderFilter === value
                          ? value === 'male'
                            ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/30'
                            : value === 'female'
                            ? 'bg-[#FF0090] text-white shadow-sm shadow-primary/30'
                            : 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-white/10',
                      ].join(' ')}
                    >
                      {icon}{label}
                    </button>
                  ))}
                </div>

                {/* Sort + inactive + exit */}
                <div className="flex items-center gap-0.5 bg-muted/40 rounded-2xl p-1">
                  <button
                    onClick={() => setSortOrder((o) => o === 'asc' ? 'desc' : 'asc')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-150 cursor-pointer"
                  >
                    {sortOrder === 'asc' ? <ArrowUpAZ size={13} /> : <ArrowDownAZ size={13} />}
                    Nama
                  </button>
                  {inactiveStaff.length > 0 && (
                    <>
                      <div className="w-px h-4 bg-border/60 mx-0.5" />
                      <button
                        onClick={toggleShowInactive}
                        aria-pressed={showInactive}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-150 cursor-pointer"
                      >
                        <span className="select-none">Nonaktif ({inactiveStaff.length})</span>
                        <span className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${showInactive ? 'bg-primary' : 'bg-muted-foreground/40'}`}>
                          <span className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${showInactive ? 'translate-x-3' : 'translate-x-0'}`} />
                        </span>
                      </button>
                    </>
                  )}
                  <div className="w-px h-4 bg-border/60 mx-0.5" />
                  <button
                    onClick={() => setIsFullscreen(false)}
                    title="Keluar (Esc)"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-150 cursor-pointer"
                  >
                    <Minimize2 size={13} />
                    Keluar
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className={isFullscreen ? 'min-h-0 overflow-hidden' : 'h-full'}>
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
                onOpen={setSelectedVisitId}
                onPendingLeaveClick={(staffName, leave) => setLeavePopover({ staffName, leave })}
                onStaffClick={setSelectedStaffId}
                onNoShow={handleNoShow}
                onPayment={handleOpenPayment}
              />
            )}
          </div>
        </div>

        <Legend />
      </div>

      {assignTarget && (
        <AssignDialog
          target={assignTarget}
          onClose={() => setAssignTarget(null)}
          onSaved={() => {
            setAssignTarget(null)
            loadAll(selectedDate)
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
        onClose={() => setSelectedVisitId(null)}
        onSaved={() => { setSelectedVisitId(null); loadAll(selectedDate) }}
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
            attending_staff_name: staff.find((s) => s.staff_id === paymentVisit.attending_staff_id)?.nickname
              || staff.find((s) => s.staff_id === paymentVisit.attending_staff_id)?.full_name,
          }}
          onClose={() => setPaymentVisit(null)}
          onSuccess={() => loadAll(selectedDate)}
        />
      )}
    </>
  )
}
