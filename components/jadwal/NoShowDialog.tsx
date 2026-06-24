'use client'

import { useEffect, useState } from 'react'
import { X, UserX, CalendarClock, Loader2 } from 'lucide-react'
import {
  markNoShowAndReschedule,
  fetchBranchStaff,
  type BranchStaffMember,
  type RescheduleInput,
} from '@/app/actions/jadwal'
import type { DailyVisit } from '@/app/actions/jadwal'

interface Props {
  visit: DailyVisit
  onClose: () => void
  onSaved: () => void
}

export function NoShowDialog({ visit, onClose, onSaved }: Props) {
  const [willReschedule, setWillReschedule] = useState(true)

  const [newDate,     setNewDate]     = useState(visit.visit_date)
  const [newTime,     setNewTime]     = useState(visit.visit_time ?? '')
  const [newShift,    setNewShift]    = useState<'PAGI' | 'SORE' | ''>('')
  const [newNotes,    setNewNotes]    = useState('')
  const [therapistId, setTherapistId] = useState<string>(visit.attending_staff_id ?? '')

  const [staffList,    setStaffList]    = useState<BranchStaffMember[]>([])
  const [staffLoading, setStaffLoading] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  useEffect(() => {
    if (!willReschedule || !visit.branch_id) return
    setStaffLoading(true)
    fetchBranchStaff(visit.branch_id).then((list) => {
      setStaffList(list)
      setStaffLoading(false)
    })
  }, [willReschedule, visit.branch_id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleConfirm() {
    setSaving(true)
    setError(null)

    let reschedule: RescheduleInput | undefined
    if (willReschedule) {
      if (!newDate) {
        setError('Tanggal baru wajib diisi.')
        setSaving(false)
        return
      }
      reschedule = {
        visit_date:         newDate,
        visit_time:         newTime || null,
        attending_staff_id: therapistId || null,
        notes:              newNotes.trim() || null,
        shift:              newShift || null,
      }
    }

    const { error: err } = await markNoShowAndReschedule(visit.id, reschedule)
    setSaving(false)
    if (err) { setError(err); return }
    onSaved()
  }

  const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
  const labelCls = 'block text-xs font-medium text-foreground mb-1'

  const fmtDate = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Tandai tidak hadir dan jadwal ulang"
        className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
              <UserX size={15} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Tidak Hadir</p>
              <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                {visit.patient_name} · {fmtDate(visit.visit_date)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="px-3 py-2.5 rounded-xl bg-muted/30 border border-border/50 text-xs text-muted-foreground space-y-0.5">
            <p>
              Kunjungan <span className="font-semibold text-foreground">{visit.patient_name}</span> akan
              ditandai sebagai <span className="font-semibold text-foreground">Tidak Hadir</span>.
            </p>
            {visit.visit_time && (
              <p>Waktu terjadwal: <span className="font-mono">{visit.visit_time}</span></p>
            )}
          </div>

          {/* Reschedule toggle */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <CalendarClock size={14} className="text-primary" />
                Jadwal Ulang
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Buat kunjungan baru untuk pasien ini</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={willReschedule}
              onClick={() => setWillReschedule((v) => !v)}
              className={[
                'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer',
                willReschedule ? 'bg-primary' : 'bg-muted',
              ].join(' ')}
            >
              <span
                className={[
                  'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                  willReschedule ? 'translate-x-4' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </div>

          {/* Reschedule form */}
          {willReschedule && (
            <div className="space-y-3 pt-1 border-t border-border/50">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>
                    Tanggal Baru <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Jam</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Shift</label>
                <select
                  value={newShift}
                  onChange={(e) => setNewShift(e.target.value as 'PAGI' | 'SORE' | '')}
                  className={inputCls}
                >
                  <option value="">— Pilih Shift —</option>
                  <option value="PAGI">PAGI</option>
                  <option value="SORE">SORE</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Terapis</label>
                {staffLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 size={12} className="animate-spin" /> Memuat terapis...
                  </div>
                ) : (
                  <select
                    value={therapistId}
                    onChange={(e) => setTherapistId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— Pilih Terapis (opsional) —</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nickname ? `${s.nickname} (${s.full_name})` : s.full_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className={labelCls}>
                  Catatan <span className="text-muted-foreground font-normal">(opsional)</span>
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={2}
                  placeholder="mis. Dijadwalkan ulang karena tidak hadir"
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving
              ? 'Menyimpan...'
              : willReschedule
              ? 'Tandai & Jadwal Ulang'
              : 'Tandai Tidak Hadir'}
          </button>
        </div>
      </div>
    </div>
  )
}
