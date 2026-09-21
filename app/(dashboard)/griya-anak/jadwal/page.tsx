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
import { MoveScopeDialog, type MoveDest, type MoveTarget } from '@/components/griya/MoveScopeDialog'
import { ManageTherapistsDialog } from '@/components/griya/ManageTherapistsDialog'
import { AddStudentButton } from '@/components/griya/AddStudentButton'
import { EditVisitDialog } from '@/components/griya/EditVisitDialog'
import { SessionNoteModal } from '@/components/griya/SessionNoteModal'
import { CoverUnassignedDialog } from '@/components/griya/CoverUnassignedDialog'
import { AddMasterScheduleDialog } from '@/components/griya/master/AddMasterScheduleDialog'
import { PaymentDialog } from '@/components/visits/PaymentDialog'
import { ConfirmDialog } from '@/components/leave/ConfirmDialog'
import { markAttendance, resetAttendance, markVisitAttendance, resetVisitAttendance, cancelOccurrence } from '@/app/actions/griyaJadwal'
import { updateVisitStatus, deleteVisit } from '@/app/actions/jadwal'
import { getGriyaVisitFormRoute } from '@/lib/griyaVisitRouting'
import type { CellAction } from '@/components/griya/SlotCell'
import type { ResolvedCell } from '@/components/griya/resolve'
import type { CellTarget } from '@/components/griya/types'
import type { GriyaSlot } from '@/app/actions/griyaJadwal'

export default function GriyaJadwalPage() {
  const { today, selectedDate, setSelectedDate, week, loading, enabled, canEdit, branchId, reload, markPresentOptimistic } = useGriyaJadwal()
  const { showToast } = useToast()

  const dateIso = toIso(selectedDate)
  const hari = hariOf(selectedDate)

  const [assign, setAssign] = useState<CellTarget | null>(null)
  const [attendance, setAttendance] = useState<CellTarget | null>(null)
  const [endTarget, setEndTarget] = useState<CellTarget | null>(null)
  const [moveSrc, setMoveSrc] = useState<MoveTarget | null>(null)
  const [moveDialog, setMoveDialog] = useState<{ target: MoveTarget; dest: MoveDest } | null>(null)
  const [coverSlot, setCoverSlot] = useState<GriyaSlot | null>(null)
  const [addMaster, setAddMaster] = useState<CellTarget | null>(null)
  const [payVisit, setPayVisit] = useState<ResolvedCell | null>(null)
  const [editVisit, setEditVisit] = useState<ResolvedCell | null>(null)
  const [examineVisit, setExamineVisit] = useState<ResolvedCell | null>(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<{ kind: 'cancel' | 'delete'; cell: ResolvedCell } | null>(null)
  const [confirming, setConfirming] = useState(false)

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
    if (action === 'coverUnassigned') {
      if (cell?.slot) setCoverSlot(cell.slot)
      return
    }

    const target = targetFor(cellKey, cell)
    if (!target) { showToast('Sel ini tidak valid — muat ulang halaman dan coba lagi.', 'error'); return }

    // move-destination pick
    if (moveSrc && action === 'move') {
      const col = week.therapists.find((t) => t.therapist_id === target.therapistId)
      if (!col) { showToast('Kolom terapis tujuan tidak ditemukan.', 'error'); return }
      setMoveDialog({
        target: moveSrc,
        dest: { therapistId: target.therapistId, therapistName: target.therapistName, discipline: col.discipline, hari, hour: target.hour, dateIso },
      })
      setMoveSrc(null)
      return
    }

    switch (action) {
      case 'assign': setAddMaster(target); break
      case 'substitute': setAssign(target); break
      case 'attendance': setAttendance(target); break
      case 'end': setEndTarget(target); break
      case 'move':
        if (cell?.slot) setMoveSrc({ kind: 'slot', slot: cell.slot })
        else if (cell?.visit?.id) setMoveSrc({ kind: 'visit', visitId: cell.visit.id, patientName: cell.studentName })
        else showToast('Tidak ada jadwal untuk dipindahkan di sel ini.', 'error')
        break
      case 'markPresent': {
        if (!cell?.slot && !cell?.visit?.id) break
        const patientId = cell.slot?.patient_id ?? cell.visit?.patient_id
        if (patientId) {
          markPresentOptimistic({
            visitId: cell.visit?.id ?? null,
            slotId: cell.slot?.id ?? null,
            dateIso,
            patientId,
            patientName: cell.studentName,
          })
        }
        const { error } = cell?.slot
          ? await markAttendance(cell.slot.id, dateIso, { present: true })
          : await markVisitAttendance(cell!.visit!.id, { present: true })
        if (error) { showToast(error, 'error'); reload({ silent: true }) }
        else { showToast('Ditandai hadir', 'success'); reload({ silent: true }) }
        break
      }
      case 'unmarkAttendance': {
        if (!cell?.slot && !cell?.visit?.id) break
        const { error } = cell?.slot
          ? await resetAttendance(cell.slot.id, dateIso)
          : await resetVisitAttendance(cell!.visit!.id)
        if (error) showToast(error, 'error')
        else { showToast('Tanda kehadiran dibatalkan', 'success'); reload({ silent: true }) }
        break
      }
      case 'pay':
        if (cell?.visit?.id) setPayVisit(cell)
        else showToast('Tandai hadir dulu sebelum mencatat pembayaran.', 'info')
        break
      case 'editVisit':
        if (cell?.visit?.id) setEditVisit(cell)
        else showToast('Belum ada data kunjungan untuk diubah — tandai hadir/tidak hadir dulu.', 'error')
        break
      case 'examine':
        if (cell?.visit?.id) {
          const route = getGriyaVisitFormRoute(cell.visit.service_type)
          if (route === 'terapi-awal') {
            window.open(`/griya-anak/siswa/${cell.visit.patient_id}/terapi-awal/${cell.visit.id}`, '_blank', 'noopener,noreferrer')
          } else {
            setExamineVisit(cell)
          }
        } else {
          showToast('Belum ada data kunjungan untuk diperiksa.', 'error')
        }
        break
      case 'open': {
        const pid = cell?.slot?.patient_id ?? cell?.visit?.patient_id
        if (pid) window.open(`/griya-anak/siswa/${pid}`, '_blank', 'noopener,noreferrer')
        else showToast('Data anak tidak ditemukan untuk sel ini.', 'error')
        break
      }
      case 'cancel':
        if (cell) setConfirmTarget({ kind: 'cancel', cell })
        else showToast('Tidak ada jadwal untuk dibatalkan di sel ini.', 'error')
        break
      case 'deleteVisit':
        if (cell?.visit?.id) setConfirmTarget({ kind: 'delete', cell })
        else showToast('Belum ada data kunjungan untuk dihapus.', 'error')
        break
    }
  }

  async function runConfirmedAction() {
    if (!confirmTarget) return
    const { kind, cell } = confirmTarget
    setConfirming(true)
    const { error } = kind === 'cancel'
      ? cell.slot
        ? await cancelOccurrence(cell.slot.id, dateIso)
        : await updateVisitStatus(cell.visit!.id, 'cancelled')
      : await deleteVisit(cell.visit!.id)
    setConfirming(false)
    if (error) { showToast(error, 'error'); return }
    showToast(kind === 'cancel' ? 'Jadwal dibatalkan' : 'Kunjungan dihapus', 'success')
    setConfirmTarget(null)
    reload({ silent: true })
  }

  function afterMutation() {
    setAssign(null); setAttendance(null); setEndTarget(null); setMoveSrc(null); setMoveDialog(null); setPayVisit(null); setEditVisit(null); setExamineVisit(null); setCoverSlot(null); setAddMaster(null); setConfirmTarget(null)
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
        <div className="flex items-center gap-2 flex-wrap">
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

      {moveSrc && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl border border-primary/30 bg-primary/10 text-primary text-sm">
          <span>Pilih sel tujuan untuk memindahkan <b>{moveSrc.kind === 'slot' ? moveSrc.slot.patient_name : moveSrc.patientName}</b></span>
          <button onClick={() => setMoveSrc(null)} className="text-xs font-semibold cursor-pointer">Batal</button>
        </div>
      )}

      {loading ? <GridSkeleton /> : (
        <DayGrid
          week={week}
          dateIso={dateIso}
          hari={hari}
          canEdit={canEdit}
          moveMode={!!moveSrc}
          onCellAction={handleCellAction}
          onDrop={(slotId, dest) => {
            const slot = week.slots.find((s) => s.id === slotId)
            if (slot) setMoveDialog({ target: { kind: 'slot', slot }, dest })
          }}
        />
      )}

      <Legend />

      {assign && (
        <AssignStudentDialog target={assign} onClose={() => setAssign(null)} onSaved={afterMutation} />
      )}
      {coverSlot && (
        <CoverUnassignedDialog slot={coverSlot} dateIso={dateIso} therapists={week.therapists} onClose={() => setCoverSlot(null)} onSaved={afterMutation} />
      )}
      {addMaster && branchId && (
        <AddMasterScheduleDialog
          branchId={branchId}
          initialHari={addMaster.hari}
          initialHour={addMaster.hour}
          initialDiscipline={addMaster.discipline}
          allowTherapistPin
          therapists={week.therapists}
          initialTherapistId={addMaster.therapistId}
          initialDateIso={addMaster.dateIso}
          onClose={() => setAddMaster(null)}
          onSaved={afterMutation}
        />
      )}
      {attendance && (
        <AttendanceDialog target={attendance} onClose={() => setAttendance(null)} onSaved={afterMutation} />
      )}
      {endTarget && (
        <EndEnrollmentDialog target={endTarget} onClose={() => setEndTarget(null)} onSaved={afterMutation} />
      )}
      {moveDialog && (
        <MoveScopeDialog target={moveDialog.target} dest={moveDialog.dest} onClose={() => setMoveDialog(null)} onSaved={afterMutation} />
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
      {examineVisit?.visit && branchId && (
        <SessionNoteModal
          target={{
            visitId: examineVisit.visit.id,
            patientId: examineVisit.visit.patient_id,
            patientName: examineVisit.studentName,
            branchId,
            griyaSlotId: examineVisit.visit.griya_slot_id,
          }}
          onClose={() => setExamineVisit(null)}
          onSaved={() => { setExamineVisit(null); showToast('Rekam periksa disimpan', 'success'); reload({ silent: true }) }}
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
      {confirmTarget && (
        <ConfirmDialog
          title={confirmTarget.kind === 'cancel' ? 'Batalkan Jadwal' : 'Hapus Kunjungan'}
          description={
            confirmTarget.kind === 'cancel'
              ? `Batalkan jadwal ${confirmTarget.cell.studentName} untuk ${HARI_LABEL[hari]}, ${selectedDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}?`
              : `Hapus kunjungan ${confirmTarget.cell.studentName} secara permanen? Tindakan ini tidak bisa dibatalkan.`
          }
          confirmLabel={confirmTarget.kind === 'cancel' ? 'Batalkan' : 'Hapus'}
          danger={confirmTarget.kind === 'delete'}
          loading={confirming}
          onConfirm={runConfirmedAction}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </div>
  )
}
