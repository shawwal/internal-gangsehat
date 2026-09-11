'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useGriyaJadwal } from '@/hooks/useGriyaJadwal'
import { useToast } from '@/context/ToastContext'
import { WeekNav } from '@/components/griya/WeekNav'
import { getMondayOf } from '@/components/jadwal/utils'
import { GridSkeleton } from '@/components/griya/GridSkeleton'
import { Legend } from '@/components/griya/Legend'
import { WeekGrid, type WeekEntry } from '@/components/griya/WeekGrid'
import { WeekMoveDialog } from '@/components/griya/WeekMoveDialog'
import { AssignStudentDialog } from '@/components/griya/AssignStudentDialog'
import { AttendanceDialog } from '@/components/griya/AttendanceDialog'
import { EndEnrollmentDialog } from '@/components/griya/EndEnrollmentDialog'
import { EditVisitDialog } from '@/components/griya/EditVisitDialog'
import { PaymentDialog } from '@/components/visits/PaymentDialog'
import { DISCIPLINE_LABEL, DISCIPLINES } from '@/components/griya/constants'
import { markAttendance, resetAttendance } from '@/app/actions/griyaJadwal'
import type { CellAction } from '@/components/griya/SlotCell'
import type { ResolvedCell } from '@/components/griya/resolve'
import type { CellTarget } from '@/components/griya/types'
import type { Discipline, GriyaSlot, Hari } from '@/app/actions/griyaJadwal'

export default function GriyaJadwalMingguanPage() {
  const { today, selectedDate, setSelectedDate, week, loading, enabled, canEdit, branchId, reload } = useGriyaJadwal()
  const { showToast } = useToast()
  const [discipline, setDiscipline] = useState<Discipline | 'ALL'>('ALL')

  const [assign, setAssign] = useState<{ target: CellTarget; mode: 'assign' | 'substitute' } | null>(null)
  const [attendance, setAttendance] = useState<CellTarget | null>(null)
  const [endTarget, setEndTarget] = useState<CellTarget | null>(null)
  const [moveTarget, setMoveTarget] = useState<{ slot: GriyaSlot; hari: Hari } | null>(null)
  const [payVisit, setPayVisit] = useState<ResolvedCell | null>(null)
  const [editVisit, setEditVisit] = useState<ResolvedCell | null>(null)

  const weekMonday = getMondayOf(selectedDate)
  const weekEnd = new Date(weekMonday)
  weekEnd.setDate(weekEnd.getDate() + 6)

  function therapistMeta(therapistId: string) {
    const t = week.therapists.find((x) => x.therapist_id === therapistId)
    return { name: t?.nickname || t?.full_name || '—', discipline: (t?.discipline ?? 'FISIOTERAPI') as Discipline }
  }

  function targetForEntry(entry: WeekEntry): CellTarget | null {
    if (!branchId) return null
    const meta = therapistMeta(entry.cell.therapistId)
    return {
      therapistId: entry.cell.therapistId,
      therapistName: meta.name,
      discipline: meta.discipline,
      hari: entry.hari,
      hour: entry.cell.hour,
      dateIso: entry.dateIso,
      branchId,
      slot: entry.cell.slot,
      visit: entry.cell.visit,
    }
  }

  async function handleCellAction(action: CellAction, entry: WeekEntry) {
    const target = targetForEntry(entry)
    if (!target) return

    switch (action) {
      case 'substitute': setAssign({ target, mode: 'substitute' }); break
      case 'attendance': setAttendance(target); break
      case 'end': setEndTarget(target); break
      case 'move': if (entry.cell.slot) setMoveTarget({ slot: entry.cell.slot, hari: entry.hari }); break
      case 'markPresent':
        if (entry.cell.slot) {
          const { error } = await markAttendance(entry.cell.slot.id, entry.dateIso, { present: true })
          if (error) showToast(error, 'error')
          else { showToast('Ditandai hadir', 'success'); reload({ silent: true }) }
        }
        break
      case 'unmarkAttendance':
        if (entry.cell.slot) {
          const { error } = await resetAttendance(entry.cell.slot.id, entry.dateIso)
          if (error) showToast(error, 'error')
          else { showToast('Tanda kehadiran dibatalkan', 'success'); reload({ silent: true }) }
        }
        break
      case 'pay':
        if (entry.cell.visit?.id) setPayVisit(entry.cell)
        else showToast('Tandai hadir dulu sebelum mencatat pembayaran.', 'info')
        break
      case 'editVisit':
        if (entry.cell.visit?.id) setEditVisit(entry.cell)
        break
      case 'open': {
        const pid = entry.cell.slot?.patient_id ?? entry.cell.visit?.patient_id
        if (pid) window.open(`/griya-anak/siswa/${pid}`, '_blank', 'noopener,noreferrer')
        break
      }
    }
  }

  function afterMutation() {
    setAssign(null); setAttendance(null); setEndTarget(null); setMoveTarget(null); setPayVisit(null); setEditVisit(null)
    reload({ silent: true })
  }

  if (branchId === null && enabled === false) {
    return <div className="glass-card p-8 text-sm text-muted-foreground">Fitur Jadwal Griya Anak belum aktif untuk cabang ini.</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Jadwal Mingguan Griya Anak</h1>
          <p className="text-sm text-muted-foreground">
            {weekMonday.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} –{' '}
            {weekEnd.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value as Discipline | 'ALL')}
            className="px-3 py-2 rounded-xl border border-border text-sm bg-background cursor-pointer"
          >
            <option value="ALL">Semua disiplin</option>
            {DISCIPLINES.map((d) => (
              <option key={d} value={d}>{DISCIPLINE_LABEL[d]}</option>
            ))}
          </select>
          <button
            onClick={() => reload()}
            className="p-2 rounded-xl border border-border hover:bg-muted cursor-pointer text-muted-foreground"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <WeekNav selectedDate={selectedDate} today={today} onSelect={setSelectedDate} />

      {loading ? (
        <GridSkeleton />
      ) : (
        <WeekGrid
          week={week}
          weekMonday={weekMonday}
          today={today}
          disciplineFilter={discipline}
          canEdit={canEdit}
          onCellAction={handleCellAction}
        />
      )}

      <Legend />

      {assign && (
        <AssignStudentDialog target={assign.target} mode={assign.mode} onClose={() => setAssign(null)} onSaved={afterMutation} />
      )}
      {attendance && (
        <AttendanceDialog target={attendance} onClose={() => setAttendance(null)} onSaved={afterMutation} />
      )}
      {endTarget && (
        <EndEnrollmentDialog target={endTarget} onClose={() => setEndTarget(null)} onSaved={afterMutation} />
      )}
      {moveTarget && (
        <WeekMoveDialog
          week={week}
          weekMonday={weekMonday}
          slot={moveTarget.slot}
          initialHari={moveTarget.hari}
          onClose={() => setMoveTarget(null)}
          onSaved={afterMutation}
        />
      )}
      {payVisit?.visit && branchId && (
        <PaymentDialog
          visit={{
            id: payVisit.visit.id,
            patient_id: payVisit.visit.patient_id,
            patient_name: payVisit.studentName,
            visit_date: payVisit.visit.visit_date,
            service_type: payVisit.visit.service_type,
            branch_id: branchId,
          }}
          onClose={() => setPayVisit(null)}
          onSuccess={afterMutation}
        />
      )}
      {editVisit?.visit && branchId && (
        <EditVisitDialog
          visit={{
            id: editVisit.visit.id,
            visit_date: editVisit.visit.visit_date,
            visit_time: editVisit.visit.visit_time,
            service_type: editVisit.visit.service_type,
            status: editVisit.visit.status,
            kehadiran: editVisit.visit.kehadiran,
            notes: editVisit.visit.notes,
            attending_staff_id: editVisit.visit.attending_staff_id,
            patient_name: editVisit.studentName,
          }}
          branchId={branchId}
          onClose={() => setEditVisit(null)}
          onSaved={afterMutation}
        />
      )}
    </div>
  )
}
