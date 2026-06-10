'use client'

import { useState } from 'react'
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
import type { AssignTarget } from '@/components/jadwal/types'

export default function JadwalHarianPage() {
  const {
    today, selectedDate, setSelectedDate,
    staff, visits, loading,
    leavePopover, setLeavePopover,
    leaveSaving, canApproveLeave,
    loadAll, handleStatusChange, handleDelete, handleLeaveAction,
  } = useJadwalHarian()

  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null)

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

        <PageHeader
          date={selectedDate}
          loading={loading}
          onRefresh={() => loadAll(selectedDate)}
        />

        <DateNav
          selectedDate={selectedDate}
          today={today}
          onSelect={setSelectedDate}
        />

        {!loading && <VisitSummary visits={visits} staff={staff} />}

        <div className="glass-card overflow-hidden">
          {loading ? (
            <GridSkeleton />
          ) : (
            <DailyGrid
              staff={staff}
              visits={visits}
              date={toIso(selectedDate)}
              onAssign={setAssignTarget}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onPendingLeaveClick={(staffName, leave) => setLeavePopover({ staffName, leave })}
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
    </>
  )
}
