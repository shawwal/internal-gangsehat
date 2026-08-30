'use client'

import { useState } from 'react'
import { Users, RefreshCw } from 'lucide-react'
import { useGriyaJadwal } from '@/hooks/useGriyaJadwal'
import { useToast } from '@/context/ToastContext'
import { DateNav } from '@/components/jadwal/DateNav'
import { hariOf, toIso, HARI_LABEL } from '@/components/griya/constants'
import { DayGrid } from '@/components/griya/DayGrid'
import { GridSkeleton } from '@/components/griya/GridSkeleton'
import { Legend } from '@/components/griya/Legend'
import { AssignStudentDialog } from '@/components/griya/AssignStudentDialog'
import { AttendanceDialog } from '@/components/griya/AttendanceDialog'
import { EndEnrollmentDialog } from '@/components/griya/EndEnrollmentDialog'
import { MoveScopeDialog, type MoveDest } from '@/components/griya/MoveScopeDialog'
import { ManageTherapistsDialog } from '@/components/griya/ManageTherapistsDialog'
import { AddStudentButton } from '@/components/griya/AddStudentButton'
import { EditVisitDialog } from '@/components/griya/EditVisitDialog'
import { PaymentDialog } from '@/components/visits/PaymentDialog'
import { markAttendance } from '@/app/actions/griyaJadwal'
import type { CellAction } from '@/components/griya/SlotCell'
import type { ResolvedCell } from '@/components/griya/resolve'
import type { CellTarget } from '@/components/griya/types'
import type { GriyaSlot } from '@/app/actions/griyaJadwal'

export default function GriyaJadwalPage() {
  const { today, selectedDate, setSelectedDate, week, loading, enabled, canEdit, branchId, reload } = useGriyaJadwal()
  const { showToast } = useToast()

  const dateIso = toIso(selectedDate)
  const hari = hariOf(selectedDate)

  const [assign, setAssign] = useState<{ target: CellTarget; mode: 'assign' | 'substitute' } | null>(null)
  const [attendance, setAttendance] = useState<CellTarget | null>(null)
  const [endTarget, setEndTarget] = useState<CellTarget | null>(null)
  const [moveSlot, setMoveSlot] = useState<GriyaSlot | null>(null)
  const [moveDialog, setMoveDialog] = useState<{ slot: GriyaSlot; dest: MoveDest } | null>(null)
  const [payVisit, setPayVisit] = useState<ResolvedCell | null>(null)
  const [editVisit, setEditVisit] = useState<ResolvedCell | null>(null)
  const [manageOpen, setManageOpen] = useState(false)

  function targetFor(cellKey: string, cell?: ResolvedCell): CellTarget | null {
    const [therapistId, hour] = cellKey.split('|')
    const col = week.therapists.find((t) => t.therapist_id === therapistId)
    if (!col || !branchId) return null
    return {
      therapistId, therapistName: col.nickname || col.full_name,
      discipline: col.discipline, hari, hour, dateIso, branchId,
      slot: cell?.slot ?? null, visit: cell?.visit ?? null,
    }
  }

  async function handleCellAction(action: CellAction, cell: ResolvedCell | undefined, cellKey: string) {
    const target = targetFor(cellKey, cell)
    if (!target) return

    // move-destination pick
    if (moveSlot && action === 'move') {
      const col = week.therapists.find((t) => t.therapist_id === target.therapistId)
      if (!col) return
      setMoveDialog({
        slot: moveSlot,
        dest: { therapistId: target.therapistId, therapistName: target.therapistName, discipline: col.discipline, hari, hour: target.hour, dateIso },
      })
      setMoveSlot(null)
      return
    }

    switch (action) {
      case 'assign': setAssign({ target, mode: 'assign' }); break
      case 'substitute': setAssign({ target, mode: 'substitute' }); break
      case 'attendance': setAttendance(target); break
      case 'end': setEndTarget(target); break
      case 'move': if (cell?.slot) setMoveSlot(cell.slot); break
      case 'markPresent':
        if (cell?.slot) {
          const { error } = await markAttendance(cell.slot.id, dateIso, { present: true })
          if (error) showToast(error, 'error')
          else { showToast('Ditandai hadir', 'success'); reload({ silent: true }) }
        }
        break
      case 'pay':
        if (cell?.visit?.id) setPayVisit(cell)
        else showToast('Tandai hadir dulu sebelum mencatat pembayaran.', 'info')
        break
      case 'editVisit':
        if (cell?.visit?.id) setEditVisit(cell)
        break
      case 'open': {
        const pid = cell?.slot?.patient_id ?? cell?.visit?.patient_id
        if (pid) window.open(`/griya-anak/siswa/${pid}`, '_blank', 'noopener,noreferrer')
        break
      }
    }
  }

  function afterMutation() {
    setAssign(null); setAttendance(null); setEndTarget(null); setMoveDialog(null); setPayVisit(null); setEditVisit(null)
    reload({ silent: true })
  }

  if (branchId === null && enabled === false) {
    return <div className="glass-card p-8 text-sm text-muted-foreground">Fitur Jadwal Griya Anak belum aktif untuk cabang ini.</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Jadwal Griya Anak</h1>
          <p className="text-sm text-muted-foreground">{HARI_LABEL[hari]}, {selectedDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => reload()} className="p-2 rounded-xl border border-border hover:bg-muted cursor-pointer text-muted-foreground">
            <RefreshCw size={14} />
          </button>
          {canEdit && (
            <button onClick={() => setManageOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">
              <Users size={14} /> Kelola Terapis
            </button>
          )}
          <AddStudentButton branchId={branchId} canEdit={canEdit} variant="outline" onAdded={() => reload({ silent: true })} />
        </div>
      </div>

      <DateNav selectedDate={selectedDate} today={today} onSelect={setSelectedDate} />

      {moveSlot && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl border border-primary/30 bg-primary/10 text-primary text-sm">
          <span>Pilih sel tujuan untuk memindahkan <b>{moveSlot.patient_name}</b></span>
          <button onClick={() => setMoveSlot(null)} className="text-xs font-semibold cursor-pointer">Batal</button>
        </div>
      )}

      {loading ? <GridSkeleton /> : (
        <DayGrid
          week={week}
          dateIso={dateIso}
          hari={hari}
          canEdit={canEdit}
          moveMode={!!moveSlot}
          onCellAction={handleCellAction}
          onDrop={(slotId, dest) => {
            const slot = week.slots.find((s) => s.id === slotId)
            if (slot) setMoveDialog({ slot, dest })
          }}
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
      {moveDialog && (
        <MoveScopeDialog slot={moveDialog.slot} dest={moveDialog.dest} onClose={() => setMoveDialog(null)} onSaved={afterMutation} />
      )}
      {payVisit?.visit && (
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
      {manageOpen && branchId && (
        <ManageTherapistsDialog
          branchId={branchId}
          therapists={week.therapists}
          onClose={() => setManageOpen(false)}
          onSaved={() => reload({ silent: true })}
        />
      )}
    </div>
  )
}
