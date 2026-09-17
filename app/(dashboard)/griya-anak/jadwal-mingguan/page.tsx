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
import { CoverUnassignedDialog } from '@/components/griya/CoverUnassignedDialog'
import { AddMasterScheduleDialog } from '@/components/griya/master/AddMasterScheduleDialog'
import { AddStudentButton } from '@/components/griya/AddStudentButton'
import { PaymentDialog } from '@/components/visits/PaymentDialog'
import { ConfirmDialog } from '@/components/leave/ConfirmDialog'
import { DISCIPLINE_LABEL, DISCIPLINES } from '@/components/griya/constants'
import { markAttendance, resetAttendance, markVisitAttendance, resetVisitAttendance, cancelOccurrence } from '@/app/actions/griyaJadwal'
import { updateVisitStatus, deleteVisit } from '@/app/actions/jadwal'
import type { CellAction } from '@/components/griya/SlotCell'
import type { ResolvedCell } from '@/components/griya/resolve'
import type { CellTarget } from '@/components/griya/types'
import type { MoveTarget } from '@/components/griya/MoveScopeDialog'
import type { Discipline, GriyaSlot, Hari } from '@/app/actions/griyaJadwal'

export default function GriyaJadwalMingguanPage() {
  const { today, selectedDate, setSelectedDate, week, loading, enabled, canEdit, branchId, reload, markPresentOptimistic } = useGriyaJadwal()
  const { showToast } = useToast()
  const [discipline, setDiscipline] = useState<Discipline | 'ALL'>('ALL')

  const [assign, setAssign] = useState<CellTarget | null>(null)
  const [attendance, setAttendance] = useState<CellTarget | null>(null)
  const [endTarget, setEndTarget] = useState<CellTarget | null>(null)
  const [moveTarget, setMoveTarget] = useState<{ target: MoveTarget; hari: Hari } | null>(null)
  const [payVisit, setPayVisit] = useState<ResolvedCell | null>(null)
  const [editVisit, setEditVisit] = useState<ResolvedCell | null>(null)
  const [coverTarget, setCoverTarget] = useState<{ slot: GriyaSlot; dateIso: string } | null>(null)
  const [addMaster, setAddMaster] = useState<{ hari: Hari; hour: string } | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<{ kind: 'cancel' | 'delete'; cell: ResolvedCell; dateIso: string } | null>(null)
  const [confirming, setConfirming] = useState(false)

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
    if (action === 'coverUnassigned') {
      if (entry.cell.slot) setCoverTarget({ slot: entry.cell.slot, dateIso: entry.dateIso })
      return
    }

    const target = targetForEntry(entry)
    if (!target) { showToast('Sel ini tidak valid — muat ulang halaman dan coba lagi.', 'error'); return }

    switch (action) {
      case 'substitute': setAssign(target); break
      case 'attendance': setAttendance(target); break
      case 'end': setEndTarget(target); break
      case 'move':
        if (entry.cell.slot) setMoveTarget({ target: { kind: 'slot', slot: entry.cell.slot }, hari: entry.hari })
        else if (entry.cell.visit?.id) setMoveTarget({ target: { kind: 'visit', visitId: entry.cell.visit.id, patientName: entry.cell.studentName }, hari: entry.hari })
        else showToast('Tidak ada jadwal untuk dipindahkan di sel ini.', 'error')
        break
      case 'markPresent': {
        if (!entry.cell.slot && !entry.cell.visit?.id) break
        const patientId = entry.cell.slot?.patient_id ?? entry.cell.visit?.patient_id
        if (patientId) {
          markPresentOptimistic({
            visitId: entry.cell.visit?.id ?? null,
            slotId: entry.cell.slot?.id ?? null,
            dateIso: entry.dateIso,
            patientId,
            patientName: entry.cell.studentName,
          })
        }
        const { error } = entry.cell.slot
          ? await markAttendance(entry.cell.slot.id, entry.dateIso, { present: true })
          : await markVisitAttendance(entry.cell.visit!.id, { present: true })
        if (error) { showToast(error, 'error'); reload({ silent: true }) }
        else { showToast('Ditandai hadir', 'success'); reload({ silent: true }) }
        break
      }
      case 'unmarkAttendance': {
        if (!entry.cell.slot && !entry.cell.visit?.id) break
        const { error } = entry.cell.slot
          ? await resetAttendance(entry.cell.slot.id, entry.dateIso)
          : await resetVisitAttendance(entry.cell.visit!.id)
        if (error) showToast(error, 'error')
        else { showToast('Tanda kehadiran dibatalkan', 'success'); reload({ silent: true }) }
        break
      }
      case 'pay':
        if (entry.cell.visit?.id) setPayVisit(entry.cell)
        else showToast('Tandai hadir dulu sebelum mencatat pembayaran.', 'info')
        break
      case 'editVisit':
        if (entry.cell.visit?.id) setEditVisit(entry.cell)
        else showToast('Belum ada data kunjungan untuk diubah — tandai hadir/tidak hadir dulu.', 'error')
        break
      case 'open': {
        const pid = entry.cell.slot?.patient_id ?? entry.cell.visit?.patient_id
        if (pid) window.open(`/griya-anak/siswa/${pid}`, '_blank', 'noopener,noreferrer')
        else showToast('Data anak tidak ditemukan untuk sel ini.', 'error')
        break
      }
      case 'cancel':
        setConfirmTarget({ kind: 'cancel', cell: entry.cell, dateIso: entry.dateIso })
        break
      case 'deleteVisit':
        if (entry.cell.visit?.id) setConfirmTarget({ kind: 'delete', cell: entry.cell, dateIso: entry.dateIso })
        else showToast('Belum ada data kunjungan untuk dihapus.', 'error')
        break
    }
  }

  async function runConfirmedAction() {
    if (!confirmTarget) return
    const { kind, cell, dateIso } = confirmTarget
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
    setAssign(null); setAttendance(null); setEndTarget(null); setMoveTarget(null); setPayVisit(null); setEditVisit(null); setCoverTarget(null); setAddMaster(null); setConfirmTarget(null)
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
          <AddStudentButton branchId={branchId} canEdit={canEdit} variant="outline" onAdded={() => reload({ silent: true })} />
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
          onAddClick={(_dateIso, hari, hour) => setAddMaster({ hari, hour })}
        />
      )}

      <Legend />

      {assign && (
        <AssignStudentDialog target={assign} onClose={() => setAssign(null)} onSaved={afterMutation} />
      )}
      {addMaster && branchId && (
        <AddMasterScheduleDialog
          branchId={branchId}
          initialHari={addMaster.hari}
          initialHour={addMaster.hour}
          initialDiscipline={discipline === 'ALL' ? undefined : discipline}
          onClose={() => setAddMaster(null)}
          onSaved={afterMutation}
        />
      )}
      {coverTarget && (
        <CoverUnassignedDialog
          slot={coverTarget.slot}
          dateIso={coverTarget.dateIso}
          therapists={week.therapists}
          onClose={() => setCoverTarget(null)}
          onSaved={afterMutation}
        />
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
          target={moveTarget.target}
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
      {confirmTarget && (
        <ConfirmDialog
          title={confirmTarget.kind === 'cancel' ? 'Batalkan Jadwal' : 'Hapus Kunjungan'}
          description={
            confirmTarget.kind === 'cancel'
              ? `Batalkan jadwal ${confirmTarget.cell.studentName} untuk tanggal ${new Date(confirmTarget.dateIso + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}?`
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
