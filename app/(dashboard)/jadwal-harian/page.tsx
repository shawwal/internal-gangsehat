'use client'

import { useState, useEffect, useRef } from 'react'
import { Users, User, ArrowUpAZ, ArrowDownAZ, Maximize2, ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react'
import { useJadwalHarian } from '@/hooks/useJadwalHarian'
import { toIso, addDays, isSameDay, JS_DAY_TO_HARI, HARI_LABEL, MONTH_FULL } from '@/components/jadwal/utils'
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
  const [selectedVisitId, setSelectedVisitId]     = useState<string | null>(null)
  const [selectedVisitShift, setSelectedVisitShift] = useState<string | null>(null)
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
  const [isFocused, setIsFocused] = useState(false)
  const focusDateInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isFocused) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFocused(false) }
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('keydown', handleKey) }
  }, [isFocused])

  const dayLabel = HARI_LABEL[JS_DAY_TO_HARI[selectedDate.getDay()]]?.slice(0, 3).toUpperCase() ?? ''
  const isToday  = isSameDay(selectedDate, today)

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
        @keyframes jBarSlide {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .j-bar-slide { animation: jBarSlide 180ms cubic-bezier(0.22,1,0.36,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .j-fade-in, .j-bar-slide { animation: none; }
        }
      ` }} />

      <div className={`j-fade-in ${isFocused ? '' : 'space-y-5'}`}>

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

        {/* Controls toolbar */}
        {!loading && !isFocused && (
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
              <button
                onClick={() => setIsFocused(true)}
                title="Mode fokus (Esc untuk keluar)"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-150 cursor-pointer"
              >
                <Maximize2 size={13} />
                Fokus
              </button>
            </div>
          </div>
        )}

        <div
          className="glass-card overflow-hidden"
          style={isFocused
            ? { display: 'grid', gridTemplateRows: 'auto 1fr', height: 'calc(100vh - 4rem)', minHeight: '400px' }
            : { height: 'calc(100vh - 22rem)', minHeight: '400px' }
          }
        >
          {/* Compact topbar — focus mode only */}
          {isFocused && (
            <div className="j-bar-slide flex items-center gap-2 px-3 py-2 border-b border-white/8 bg-background/98 backdrop-blur-md shrink-0">

              {/* Branch select */}
              {branches.length > 0 && (
                <select
                  value={selectedBranchId ?? ''}
                  onChange={(e) => setSelectedBranchId(e.target.value || null)}
                  className="px-2.5 py-1.5 border border-white/10 rounded-xl text-xs bg-white/5 hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-primary/60 cursor-pointer text-foreground transition-colors duration-150 max-w-[160px] truncate"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}

              {/* Compact date nav pill */}
              <div className="flex items-center bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                  aria-label="Hari sebelumnya"
                  className="p-2 hover:bg-white/10 transition-colors duration-150 cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft size={13} />
                </button>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 select-none">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {dayLabel}
                  </span>
                  <span className={`text-sm font-bold leading-none tabular-nums ${isToday ? 'text-primary' : 'text-foreground'}`}>
                    {selectedDate.getDate()}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {MONTH_FULL[selectedDate.getMonth()].slice(0, 3)}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                  aria-label="Hari berikutnya"
                  className="p-2 hover:bg-white/10 transition-colors duration-150 cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight size={13} />
                </button>
                <div className="w-px h-5 bg-white/10 self-center" />
                <div className="relative">
                  <button
                    onClick={() => focusDateInputRef.current?.showPicker()}
                    title="Pilih tanggal"
                    aria-label="Pilih tanggal"
                    className="p-2 hover:bg-white/10 transition-colors duration-150 cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <Calendar size={13} />
                  </button>
                  <input
                    ref={focusDateInputRef}
                    type="date"
                    value={toIso(selectedDate)}
                    onChange={(e) => { if (e.target.value) setSelectedDate(new Date(e.target.value + 'T00:00:00')) }}
                    className="absolute inset-0 opacity-0 w-full h-full pointer-events-none"
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                </div>
                {!isToday && (
                  <button
                    onClick={() => setSelectedDate(new Date())}
                    aria-label="Kembali ke hari ini"
                    className="px-2.5 py-1.5 text-[10px] font-semibold text-primary hover:bg-primary/10 transition-colors duration-150 cursor-pointer border-l border-white/8"
                  >
                    Hari ini
                  </button>
                )}
              </div>

              <div className="ml-auto flex items-center gap-2">
                {/* Gender filter */}
                <div className="flex items-center bg-white/5 border border-white/8 rounded-2xl p-0.5 gap-0.5">
                  {([
                    { value: 'all',    label: 'Semua', icon: <Users size={12} /> },
                    { value: 'male',   label: 'Pria',  icon: <User  size={12} /> },
                    { value: 'female', label: 'Wanita',icon: <User  size={12} /> },
                  ] as const).map(({ value, label, icon }) => (
                    <button
                      key={value}
                      onClick={() => setGenderFilter(value)}
                      aria-pressed={genderFilter === value}
                      className={[
                        'flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all duration-150 cursor-pointer',
                        genderFilter === value
                          ? value === 'male'   ? 'bg-blue-500 text-white shadow-sm'
                          : value === 'female' ? 'bg-primary text-white shadow-sm shadow-primary/30'
                          : 'bg-white/15 text-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-white/8',
                      ].join(' ')}
                    >
                      {icon}{label}
                    </button>
                  ))}
                </div>

                {/* Sort + inactive + exit */}
                <div className="flex items-center bg-white/5 border border-white/8 rounded-2xl p-0.5">
                  <button
                    onClick={() => setSortOrder((o) => o === 'asc' ? 'desc' : 'asc')}
                    title={sortOrder === 'asc' ? 'A→Z' : 'Z→A'}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-150 cursor-pointer"
                  >
                    {sortOrder === 'asc' ? <ArrowUpAZ size={12} /> : <ArrowDownAZ size={12} />}
                    Nama
                  </button>
                  {inactiveStaff.length > 0 && (
                    <>
                      <div className="w-px h-4 bg-white/10 mx-0.5" />
                      <button
                        onClick={toggleShowInactive}
                        aria-pressed={showInactive}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-150 cursor-pointer"
                      >
                        <span className="select-none">Nonaktif</span>
                        <span className={`relative inline-flex h-3.5 w-6 shrink-0 rounded-full border border-transparent transition-colors duration-200 ${showInactive ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                          <span className={`pointer-events-none inline-block h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${showInactive ? 'translate-x-2.5' : 'translate-x-0'}`} />
                        </span>
                      </button>
                    </>
                  )}
                  <div className="w-px h-4 bg-white/10 mx-0.5" />
                  <button
                    onClick={() => setIsFocused(false)}
                    title="Keluar mode fokus (Esc)"
                    aria-label="Keluar mode fokus"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-150 cursor-pointer"
                  >
                    <X size={12} />
                    Keluar
                  </button>
                </div>
              </div>

            </div>
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
              || staff.find((s) => s.staff_id === paymentVisit.attending_staff_id)?.full_name,
          }}
          onClose={() => setPaymentVisit(null)}
          onSuccess={() => loadAll(selectedDate)}
        />
      )}
    </>
  )
}
