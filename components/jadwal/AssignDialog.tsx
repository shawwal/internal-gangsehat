'use client'

import { useEffect, useState, useRef } from 'react'
import { Search, X, User, Clock } from 'lucide-react'
import { fetchPatients, type PatientPlain } from '@/app/actions/patients'
import { createVisit } from '@/app/actions/jadwal'
import type { AssignTarget } from './types'
import type { VisitStatus } from '@/types'

const STATUS_OPTIONS: { value: VisitStatus; label: string }[] = [
  { value: 'scheduled', label: 'Terjadwal' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Batal' },
  { value: 'no_show',   label: 'Tidak Hadir' },
]

function fmtHour(h: number) {
  return `${String(h).padStart(2, '0')}:00 – ${String(h + 1).padStart(2, '0')}:00`
}

interface Props {
  target: AssignTarget
  onClose: () => void
  onSaved: () => void
}

export function AssignDialog({ target, onClose, onSaved }: Props) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [patients, setPatients]           = useState<PatientPlain[]>([])
  const [pLoading, setPLoading]           = useState(true)
  const [search, setSearch]               = useState('')
  const [selectedPatient, setSelected]    = useState<PatientPlain | null>(null)
  const [visitTime, setVisitTime]         = useState(`${String(target.hour).padStart(2, '0')}:00`)
  const [chiefComplaint, setChiefCompl]   = useState('')
  const [status, setStatus]               = useState<VisitStatus>('scheduled')
  const [notes, setNotes]                 = useState('')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const searchRef                         = useRef<HTMLInputElement>(null)

  // ── Load patients ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchPatients().then((list) => { setPatients(list); setPLoading(false) })
    setTimeout(() => searchRef.current?.focus(), 100)
  }, [])

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = search.trim()
    ? patients.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.phone ?? '').includes(search),
      )
    : patients.slice(0, 20) // show 20 most recent when no search

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!selectedPatient) return
    if (!target.branchId) {
      setError('Terapis tidak memiliki branch. Hubungi HR.')
      return
    }
    setSaving(true)
    setError(null)
    const { error: err } = await createVisit({
      patient_id:         selectedPatient.id,
      branch_id:          target.branchId,
      attending_staff_id: target.staffId,
      visit_date:         target.date,
      visit_time:         visitTime || null,
      chief_complaint:    chiefComplaint.trim() || null,
      status,
      notes:              notes.trim() || null,
    })
    setSaving(false)
    if (err) { setError(err); return }
    onSaved()
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-label="Tambah kunjungan pasien"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          className="glass-card w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 p-5 border-b border-border/30 shrink-0">
            <div>
              <h2 className="text-base font-semibold text-foreground">Tambah Kunjungan</h2>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User size={11} />
                  <span className="font-medium text-foreground">{target.staffName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock size={11} />
                  <span>{fmtHour(target.hour)}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground"
              aria-label="Tutup"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Step 1: Patient selection */}
            {!selectedPatient ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Pilih Pasien</p>

                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama atau nomor telepon..."
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                {/* Patient list */}
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {pLoading ? (
                    <div className="space-y-2 animate-pulse">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 rounded-xl bg-white/5" />
                      ))}
                    </div>
                  ) : filtered.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      {search ? 'Pasien tidak ditemukan' : 'Belum ada data pasien'}
                    </p>
                  ) : (
                    filtered.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelected(p)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-left border border-transparent hover:border-primary/30"
                      >
                        <div className={[
                          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                          p.gender === 'male'   ? 'bg-blue-500/20 text-blue-400'   :
                          p.gender === 'female' ? 'bg-primary/20 text-primary'     :
                                                  'bg-muted text-muted-foreground',
                        ].join(' ')}>
                          {p.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                          {p.phone && (
                            <p className="text-xs text-muted-foreground">{p.phone}</p>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {!search && patients.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Menampilkan 20 pasien terbaru. Ketik untuk mencari lebih.
                  </p>
                )}
              </div>
            ) : (
              /* Step 2: Visit details */
              <div className="space-y-4">
                {/* Selected patient chip */}
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/30">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {selectedPatient.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{selectedPatient.name}</p>
                    {selectedPatient.phone && (
                      <p className="text-xs text-muted-foreground">{selectedPatient.phone}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1 rounded-lg hover:bg-white/10 cursor-pointer text-muted-foreground"
                    aria-label="Ganti pasien"
                  >
                    <X size={12} />
                  </button>
                </div>

                {/* Visit time */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Jam Kunjungan
                  </label>
                  <input
                    type="time"
                    value={visitTime}
                    onChange={(e) => setVisitTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                {/* Chief complaint */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Keluhan Utama <span className="font-normal text-muted-foreground">(opsional)</span>
                  </label>
                  <input
                    value={chiefComplaint}
                    onChange={(e) => setChiefCompl(e.target.value)}
                    placeholder="Contoh: Nyeri punggung, sakit kepala..."
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Status</label>
                  <div className="flex gap-2 flex-wrap">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setStatus(opt.value)}
                        className={[
                          'px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border',
                          status === opt.value
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                        ].join(' ')}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Catatan tambahan..."
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  />
                </div>

                {/* Error */}
                {error && (
                  <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-border/30 flex gap-3 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
            >
              Batal
            </button>
            {selectedPatient && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {saving ? 'Menyimpan...' : 'Simpan Kunjungan'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
