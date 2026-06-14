'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Trash2, CalendarClock, Plus } from 'lucide-react'
import {
  fetchActiveOverrides,
  createScheduleOverride,
  cancelScheduleOverride,
} from '@/app/actions/schedule-overrides'
import type { ScheduleOverride } from '@/app/actions/schedule-overrides'

const HARI_OPTIONS = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'AHAD'] as const
const HARI_LABELS: Record<string, string> = {
  SENIN: 'Senin', SELASA: 'Selasa', RABU: 'Rabu', KAMIS: 'Kamis',
  JUMAT: 'Jumat', SABTU: 'Sabtu', AHAD: 'Ahad',
}

function fmtDateRange(start: string, end: string) {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
}

interface Props {
  staffId: string
  staffName: string
  branchId: string | null
  onClose: () => void
  onSaved: () => void
}

export function ScheduleOverrideDialog({ staffId, staffName, branchId, onClose, onSaved }: Props) {
  const [overrides, setOverrides]   = useState<ScheduleOverride[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [showForm, setShowForm]     = useState(false)

  // Form state
  const today = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate]   = useState(today)
  const [endDate, setEndDate]       = useState(today)
  const [hari, setHari]             = useState<string>('SENIN')
  const [shift, setShift]           = useState<'PAGI' | 'SORE'>('PAGI')
  const [jamMulai, setJamMulai]     = useState('09:00')
  const [jamSelesai, setJamSelesai] = useState('17:00')
  const [reason, setReason]         = useState('')

  async function loadOverrides() {
    setLoadingList(true)
    const data = await fetchActiveOverrides(staffId)
    setOverrides(data)
    setLoadingList(false)
  }

  useEffect(() => { loadOverrides() }, [staffId])

  async function handleCancel(id: string) {
    setCancellingId(id)
    const res = await cancelScheduleOverride(id)
    setCancellingId(null)
    if (res.error) { setError(res.error); return }
    await loadOverrides()
    onSaved()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (endDate < startDate) { setError('Tanggal selesai harus setelah tanggal mulai'); return }
    setSaving(true)
    setError('')
    const res = await createScheduleOverride({
      staff_id:   staffId,
      branch_id:  branchId,
      start_date: startDate,
      end_date:   endDate,
      hari,
      shift,
      jam_mulai:  jamMulai,
      jam_selesai: jamSelesai,
      reason,
    })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setShowForm(false)
    setReason('')
    await loadOverrides()
    onSaved()
  }

  const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-md shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between shrink-0"
          style={{ background: 'linear-gradient(135deg, #3B0764 0%, #6D28D9 50%, #FF0090 100%)' }}
        >
          <div className="flex items-center gap-2.5">
            <CalendarClock size={16} className="text-white/80" />
            <div>
              <p className="text-white font-semibold text-sm leading-tight">Jadwal Sementara</p>
              <p className="text-white/60 text-[11px]">{staffName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {error && (
            <p className="text-sm px-3 py-2 rounded-xl bg-destructive/10 text-destructive">{error}</p>
          )}

          {/* Active overrides list */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Override Aktif
            </p>
            {loadingList ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                <Loader2 size={13} className="animate-spin" /> Memuat...
              </div>
            ) : overrides.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Tidak ada override aktif.</p>
            ) : (
              <div className="space-y-2">
                {overrides.map((ov) => (
                  <div key={ov.id} className="flex items-start justify-between gap-3 px-3 py-2.5 rounded-xl bg-secondary/10 border border-secondary/20">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/30 text-secondary font-bold uppercase">
                          {ov.shift}
                        </span>
                        <span className="text-[10px] font-bold text-secondary">{HARI_LABELS[ov.hari]}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {ov.jam_mulai.slice(0, 5)}–{ov.jam_selesai.slice(0, 5)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{fmtDateRange(ov.start_date, ov.end_date)}</p>
                      {ov.reason && <p className="text-xs text-foreground/70 mt-0.5 italic">"{ov.reason}"</p>}
                    </div>
                    <button
                      disabled={cancellingId === ov.id}
                      onClick={() => handleCancel(ov.id)}
                      className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      title="Batalkan override"
                    >
                      {cancellingId === ov.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <Trash2 size={13} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add form toggle */}
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Plus size={14} /> Tambah Override Baru
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 pt-1 border-t border-border">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide pt-1">
                Tambah Override
              </p>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Mulai</label>
                  <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Selesai</label>
                  <input type="date" required value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* Day + Shift */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Hari Baru</label>
                  <select value={hari} onChange={(e) => setHari(e.target.value)} className={inputCls}>
                    {HARI_OPTIONS.map((h) => (
                      <option key={h} value={h}>{HARI_LABELS[h]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Shift</label>
                  <select value={shift} onChange={(e) => setShift(e.target.value as 'PAGI' | 'SORE')} className={inputCls}>
                    <option value="PAGI">Pagi</option>
                    <option value="SORE">Sore</option>
                  </select>
                </div>
              </div>

              {/* Time range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Jam Mulai</label>
                  <input type="time" required value={jamMulai} onChange={(e) => setJamMulai(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Jam Selesai</label>
                  <input type="time" required value={jamSelesai} onChange={(e) => setJamSelesai(e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Alasan <span className="text-muted-foreground font-normal">(opsional)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Misal: Ganti jadwal karena pelatihan"
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError('') }}
                  className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
