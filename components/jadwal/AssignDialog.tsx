'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { Search, X, User, Clock, Package, AlertTriangle, CalendarDays, Repeat2 } from 'lucide-react'
import { searchPatients, type PatientPlain } from '@/app/actions/patients'
import { createVisit, createBulkVisits } from '@/app/actions/jadwal'
import { fetchPatientPackages } from '@/app/actions/packages'
import type { AssignTarget } from './types'
import type { PatientPackage, VisitStatus } from '@/types'

// ── Constants ──────────────────────────────────────────────────────────────────
const STATUS_OPTIONS: { value: VisitStatus; label: string }[] = [
  { value: 'scheduled', label: 'Terjadwal' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Batal' },
  { value: 'no_show',   label: 'Tidak Hadir' },
]

// SEN=1, SEL=2, RAB=3, KAM=4, JUM=5, SAB=6, MIN=0
const DAY_CHIPS = [
  { dow: 1, label: 'SEN' },
  { dow: 2, label: 'SEL' },
  { dow: 3, label: 'RAB' },
  { dow: 4, label: 'KAM' },
  { dow: 5, label: 'JUM' },
  { dow: 6, label: 'SAB' },
  { dow: 0, label: 'MIN' },
]

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtHour(h: number) {
  return `${String(h).padStart(2, '0')}:00 – ${String(h + 1).padStart(2, '0')}:00`
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  target: AssignTarget
  onClose: () => void
  onSaved: () => void
}

// ── Component ──────────────────────────────────────────────────────────────────
export function AssignDialog({ target, onClose, onSaved }: Props) {
  // ── Patient state ───────────────────────────────────────────────────────────
  const [results, setResults]           = useState<PatientPlain[]>([])
  const [searching, setSearching]       = useState(false)
  const [search, setSearch]             = useState('')
  const [selectedPatient, setSelected]  = useState<PatientPlain | null>(null)
  const searchRef                       = useRef<HTMLInputElement>(null)

  // ── Visit details ───────────────────────────────────────────────────────────
  const [visitTime, setVisitTime]       = useState(`${String(target.hour).padStart(2, '0')}:00`)
  const [chiefComplaint, setChiefCompl] = useState('')
  const [status, setStatus]             = useState<VisitStatus>('scheduled')
  const [notes, setNotes]               = useState('')

  // ── Mode ────────────────────────────────────────────────────────────────────
  const [mode, setMode]                 = useState<'terapi_awal' | 'single' | 'recurring'>('terapi_awal')

  // ── Recurring state ─────────────────────────────────────────────────────────
  const targetDow = useMemo(() => new Date(target.date + 'T00:00:00').getDay(), [target.date])
  const [recurDays, setRecurDays]       = useState<number[]>([targetDow])
  const [recurEnd, setRecurEnd]         = useState<string>(() => {
    const d = new Date(target.date + 'T00:00:00')
    d.setDate(d.getDate() + 27)   // default: 4 weeks
    return toIso(d)
  })

  // ── Package state ───────────────────────────────────────────────────────────
  const [packages, setPackages]         = useState<PatientPackage[]>([])
  const [pkgLoading, setPkgLoading]     = useState(false)
  const [selectedPkgId, setSelectedPkg] = useState<string | null>(null)

  // ── Save state ──────────────────────────────────────────────────────────────
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)

  // ── Focus search on open ────────────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 100)
  }, [])

  // ── Debounced patient search ────────────────────────────────────────────────
  useEffect(() => {
    const q = search.trim()
    const t = setTimeout(() => {
      if (q.length < 2) { setResults([]); setSearching(false); return }
      setSearching(true)
      searchPatients(q).then((r) => { setResults(r); setSearching(false) })
    }, q.length < 2 ? 0 : 300)
    return () => clearTimeout(t)
  }, [search])

  // ── Load packages when patient selected ────────────────────────────────────
  useEffect(() => {
    if (!selectedPatient) {
      const t = setTimeout(() => { setPackages([]); setSelectedPkg(null) }, 0)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      setPkgLoading(true)
      fetchPatientPackages(selectedPatient.id).then((pkgs) => {
        setPackages(pkgs)
        const first = pkgs.find((p) => p.status === 'active')
        setSelectedPkg(first?.id ?? null)
        setPkgLoading(false)
      })
    }, 0)
    return () => clearTimeout(t)
  }, [selectedPatient])


  // ── Recurring dates computation ─────────────────────────────────────────────
  const recurDates = useMemo<string[]>(() => {
    if (mode !== 'recurring' || recurDays.length === 0 || !recurEnd) return []
    const dates: string[] = []
    const end = new Date(recurEnd + 'T00:00:00')
    const cur = new Date(target.date + 'T00:00:00')
    let safety = 0
    while (cur <= end && safety < 366) {
      if (recurDays.includes(cur.getDay())) dates.push(toIso(cur))
      cur.setDate(cur.getDate() + 1)
      safety++
    }
    return dates
  }, [mode, recurDays, target.date, recurEnd])

  // ── Quota calculations ──────────────────────────────────────────────────────
  const selectedPkg = packages.find((p) => p.id === selectedPkgId) ?? null
  const remaining   = selectedPkg ? selectedPkg.total_sessions - selectedPkg.used_sessions : null
  const willCreate  = mode === 'recurring' ? recurDates.length : 1
  const overQuota   = remaining !== null && willCreate > remaining

  // Active packages summary for patient chip
  const activePkgs     = packages.filter((p) => p.status === 'active')
  const totalRemaining = activePkgs.reduce((s, p) => s + Math.max(0, p.total_sessions - p.used_sessions), 0)

  // ── Toggle recurring day ────────────────────────────────────────────────────
  function toggleDay(dow: number) {
    setRecurDays((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow],
    )
  }

  // ── Recurring day label (short) ─────────────────────────────────────────────
  function recurDayLabels() {
    return DAY_CHIPS.filter((c) => recurDays.includes(c.dow)).map((c) => c.label).join(' & ')
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!selectedPatient) return
    if (!target.branchId) {
      setError('Terapis tidak memiliki branch. Hubungi HR.')
      return
    }
    setSaving(true)
    setError(null)

    const base = {
      patient_id:         selectedPatient.id,
      branch_id:          target.branchId,
      attending_staff_id: target.staffId,
      service_type:       mode === 'terapi_awal' ? 'TERAPI AWAL' : 'SESI TERAPI',
      visit_time:         visitTime || null,
      chief_complaint:    chiefComplaint.trim() || null,
      status,
      notes:              notes.trim() || null,
      package_id:         selectedPkgId ?? null,
    }

    if (mode === 'terapi_awal' || mode === 'single') {
      const { error: err } = await createVisit({ ...base, visit_date: target.date })
      setSaving(false)
      if (err) { setError(err); return }
    } else {
      if (recurDates.length === 0) {
        setError('Pilih setidaknya satu hari dan pastikan tanggal akhir lebih dari tanggal mulai.')
        setSaving(false)
        return
      }
      const visits = recurDates.map((d) => ({ ...base, visit_date: d }))
      const { error: err } = await createBulkVisits(visits)
      setSaving(false)
      if (err) { setError(err); return }
    }

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
          className="glass-card w-full max-w-lg h-[80vh] flex flex-col shadow-2xl"
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

            {/* ── Step 1: Patient selection ── */}
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
                  {search.trim().length < 2 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Ketik minimal 2 huruf untuk mencari pasien
                    </p>
                  ) : searching ? (
                    <div className="space-y-2 animate-pulse">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 rounded-xl bg-white/5" />
                      ))}
                    </div>
                  ) : results.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Pasien tidak ditemukan
                    </p>
                  ) : (
                    results.map((p) => (
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

              </div>
            ) : (
              /* ── Step 2: Visit details ── */
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
                    {/* Package quota summary */}
                    {pkgLoading ? (
                      <p className="text-xs text-muted-foreground animate-pulse">Memuat paket...</p>
                    ) : activePkgs.length > 0 ? (
                      <p className="text-xs text-[#34C759] flex items-center gap-1 mt-0.5">
                        <Package size={9} />
                        {activePkgs.length} paket aktif · {totalRemaining} sesi tersisa
                      </p>
                    ) : packages.length > 0 ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Package size={9} />
                        Tidak ada paket aktif
                      </p>
                    ) : null}
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1 rounded-lg hover:bg-white/10 cursor-pointer text-muted-foreground"
                    aria-label="Ganti pasien"
                  >
                    <X size={12} />
                  </button>
                </div>

                {/* Mode tabs */}
                <div className="flex gap-1.5 p-1 rounded-xl bg-white/5 border border-border/30">
                  <button
                    onClick={() => setMode('terapi_awal')}
                    className={[
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
                      mode === 'terapi_awal'
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                  >
                    <User size={12} />
                    Terapi Awal
                  </button>
                  <button
                    onClick={() => setMode('single')}
                    className={[
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
                      mode === 'single'
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                  >
                    <CalendarDays size={12} />
                    Satu Sesi
                  </button>
                  <button
                    onClick={() => setMode('recurring')}
                    className={[
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
                      mode === 'recurring'
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                  >
                    <Repeat2 size={12} />
                    Jadwal Berulang
                  </button>
                </div>

                {/* ── Recurring-only: day + end date ── */}
                {mode === 'recurring' && (
                  <div className="space-y-3 p-3 rounded-xl bg-white/5 border border-border/20">
                    {/* Day picker */}
                    <div>
                      <p className="text-xs font-medium text-foreground mb-2">Hari</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {DAY_CHIPS.map(({ dow, label }) => (
                          <button
                            key={dow}
                            onClick={() => toggleDay(dow)}
                            className={[
                              'w-10 h-10 rounded-xl text-xs font-bold transition-all cursor-pointer border',
                              recurDays.includes(dow)
                                ? 'bg-primary text-white border-primary shadow-sm'
                                : 'border-border text-muted-foreground hover:bg-white/10 hover:text-foreground',
                            ].join(' ')}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* End date */}
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">
                        Sampai Tanggal
                      </label>
                      <input
                        type="date"
                        value={recurEnd}
                        min={toIso(addDays(new Date(target.date + 'T00:00:00'), 1))}
                        onChange={(e) => setRecurEnd(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>

                    {/* Preview pill */}
                    {recurDates.length > 0 ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
                        <Repeat2 size={12} className="text-primary shrink-0" />
                        <span className="text-xs font-semibold text-primary">
                          {recurDates.length} sesi akan dibuat
                        </span>
                        {recurDays.length > 0 && (
                          <span className="text-xs text-muted-foreground">· {recurDayLabels()}</span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-1">
                        Pilih hari dan tanggal akhir untuk melihat jadwal
                      </p>
                    )}
                  </div>
                )}

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

                {/* Package selector */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Package size={11} />
                      Paket Sesi <span className="font-normal text-muted-foreground">(opsional)</span>
                    </span>
                  </label>
                  {pkgLoading ? (
                    <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
                  ) : (
                    <select
                      value={selectedPkgId ?? ''}
                      onChange={(e) => setSelectedPkg(e.target.value || null)}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                    >
                      <option value="">— Tanpa Paket —</option>
                      {packages.map((pkg) => {
                        const rem = pkg.total_sessions - pkg.used_sessions
                        const label = `${pkg.package_name} (${pkg.package_type === 'fixed' ? 'Tetap' : 'Fleksibel'}) — ${pkg.used_sessions}/${pkg.total_sessions} · ${rem > 0 ? rem + ' tersisa' : '⚠ habis'}`
                        return (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.status !== 'active' ? `[${pkg.status}] ` : ''}{label}
                          </option>
                        )
                      })}
                    </select>
                  )}
                </div>

                {/* Quota warning — non-blocking */}
                {overQuota && selectedPkg && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-300">Kuota tidak cukup</p>
                      <p className="text-xs text-amber-400/80 mt-0.5">
                        Membuat {willCreate} sesi, tetapi hanya {Math.max(0, remaining ?? 0)} sesi tersisa pada paket &quot;{selectedPkg.package_name}&quot;.
                        Anda tetap bisa menyimpan — ingatkan pasien untuk top up paket.
                      </p>
                    </div>
                  </div>
                )}

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
                disabled={saving || (mode === 'recurring' && recurDates.length === 0)}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {saving
                  ? 'Menyimpan...'
                  : mode === 'recurring' && recurDates.length > 0
                  ? `Simpan ${recurDates.length} Sesi`
                  : mode === 'terapi_awal'
                  ? 'Simpan Terapi Awal'
                  : 'Simpan Kunjungan'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
