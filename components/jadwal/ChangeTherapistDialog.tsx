'use client'

import { useState } from 'react'
import { UserCog, AlertTriangle, Loader2 } from 'lucide-react'
import type { DailyVisit, DayStaffEntry } from './types'

interface Props {
  visit: DailyVisit
  staff: DayStaffEntry[]
  onClose: () => void
  onSave: (staffId: string, visitTime: string | null) => Promise<{ error: string | null }>
}

export function ChangeTherapistDialog({ visit, staff, onClose, onSave }: Props) {
  const [staffId, setStaffId]       = useState(visit.attending_staff_id ?? '')
  const [visitTime, setVisitTime]   = useState(visit.visit_time ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const unchanged = staffId === (visit.attending_staff_id ?? '') && visitTime === (visit.visit_time ?? '')

  async function handleConfirm() {
    if (submitting || !staffId) return
    setSubmitting(true)
    setError(null)
    const result = await onSave(staffId, visitTime || null)
    setSubmitting(false)
    if (result.error) { setError(result.error); return }
    onClose()
  }

  const sortedStaff = [...staff].sort((a, b) =>
    (a.nickname || a.full_name).localeCompare(b.nickname || b.full_name, 'id'))

  const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <UserCog size={16} className="text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Ganti Terapis</p>
            <p className="text-xs text-muted-foreground truncate">{visit.patient_name}</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {visit.kehadiran === 'HADIR' && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Pasien sudah ditandai hadir — status kehadiran & rekam medis tetap tersimpan,
              hanya terapis/jam yang diubah.
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Terapis</label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className={inputCls + ' cursor-pointer'}
            >
              {!staffId && <option value="">— Pilih terapis —</option>}
              {sortedStaff.map((s) => (
                <option key={s.staff_id} value={s.staff_id}>
                  {s.nickname || s.full_name}
                  {s.isOnLeave ? ' (cuti)' : !s.hasSchedule ? ' (tidak ada jadwal)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Jam</label>
            <input
              type="time"
              value={visitTime}
              onChange={(e) => setVisitTime(e.target.value)}
              className={inputCls}
            />
          </div>

          {error && (
            <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-destructive/8 border border-destructive/20">
              <AlertTriangle size={13} className="text-destructive shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !staffId || unchanged}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {submitting ? <><Loader2 size={14} className="animate-spin" /> Menyimpan...</> : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
