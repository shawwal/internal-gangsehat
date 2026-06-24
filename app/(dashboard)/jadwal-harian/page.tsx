'use client'

import { useState } from 'react'
import { Users, User, ArrowUpAZ, ArrowDownAZ } from 'lucide-react'
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
import type { AssignTarget } from '@/components/jadwal/types'
import type { DailyVisit } from '@/app/actions/jadwal'

const LS_KEY = 'jadwal_showInactive'

export default function JadwalHarianPage() {
  const {
    today, selectedDate, setSelectedDate,
    staff, visits, loading,
    leavePopover, setLeavePopover,
    leaveSaving, canApproveLeave,
    branches, selectedBranchId, setSelectedBranchId,
    loadAll, handleStatusChange, handleDelete, handleLeaveAction,
  } = useJadwalHarian()

  const [assignTarget, setAssignTarget]       = useState<AssignTarget | null>(null)
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [noShowVisit, setNoShowVisit]         = useState<DailyVisit | null>(null)

  function handleNoShow(visitId: string) {
    const visit = visits.find((v) => v.id === visitId) ?? null
    setNoShowVisit(visit)
  }

  const [showInactive, setShowInactive] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(LS_KEY) === 'true'
  })
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all')
  const [sortOrder, setSortOrder]       = useState<'asc' | 'desc'>('asc')

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

        {/* Gender filter */}
        {!loading && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Filter:</span>
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

            <button
              onClick={() => setSortOrder((o) => o === 'asc' ? 'desc' : 'asc')}
              title={sortOrder === 'asc' ? 'Urutan A→Z' : 'Urutan Z→A'}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-150 cursor-pointer"
            >
              {sortOrder === 'asc' ? <ArrowUpAZ size={13} /> : <ArrowDownAZ size={13} />}
              Nama
            </button>
          </div>
        )}

        {/* Inactive-staff toggle — only shown when there are inactive staff */}
        {!loading && inactiveStaff.length > 0 && (
          <div className="flex items-center justify-end">
            <button
              onClick={toggleShowInactive}
              className="flex items-center gap-2.5 group cursor-pointer"
              aria-pressed={showInactive}
            >
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors select-none">
                {showInactive
                  ? `Sembunyikan nonaktif (${inactiveStaff.length})`
                  : `Tampilkan nonaktif (${inactiveStaff.length})`}
              </span>
              {/* Pill track */}
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                  showInactive ? 'bg-primary' : 'bg-muted'
                }`}
              >
                {/* Thumb */}
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    showInactive ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>
          </div>
        )}

        <div className="glass-card overflow-hidden" style={{ height: 'calc(100vh - 22rem)', minHeight: '400px' }}>
          {loading ? (
            <GridSkeleton />
          ) : (
            <DailyGrid
              staff={visibleStaff}
              visits={visits}
              date={toIso(selectedDate)}
              onAssign={setAssignTarget}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onOpen={setSelectedVisitId}
              onPendingLeaveClick={(staffName, leave) => setLeavePopover({ staffName, leave })}
              onStaffClick={setSelectedStaffId}
              onNoShow={handleNoShow}
            />
          )}
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
    </>
  )
}
