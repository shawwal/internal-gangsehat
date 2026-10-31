'use client'

import { useEffect, useState, useRef } from 'react'
import { X, User, Clock, Check, Package } from 'lucide-react'
import { searchPatients, type PatientPlain } from '@/app/actions/patients'
import { createVisit } from '@/app/actions/jadwal'
import { fetchSportMassageLayanan, fetchSportMassagePackageLayanan, type LayananRow } from '@/app/actions/layanan'
import { fetchPatientPackages, createPackageFromLayanan, deletePatientPackage, fetchPackageSessionKinds, type PackageSessionKind } from '@/app/actions/packages'
import { DEFAULT_VISIT_MINUTES, endTime } from '@/lib/jadwal/duration'
import type { PatientPackage } from '@/types'
import type { AssignTarget } from './types'
import type { VisitStatus } from '@/types'

import { PatientSearch } from './assign/PatientSearch'
import { VisitFields } from './assign/VisitFields'
import { PaketPaymentStep } from './assign/paket/PaketPaymentStep'

interface Props {
  target: AssignTarget
  onClose: () => void
  onSaved: () => void
}

type DialogView = 'search' | 'details'

function fmtRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

// Sport Massage booking. A patient with an active Sport Massage package gets
// the session linked to it, like fisio package sessions. Otherwise the admin
// picks a single session, or buys a package here: the package is created, this
// visit becomes its first session and the payment form opens right away.
// Each visit takes its service's duration (Full Body = 90 min); a package that
// lists its contents (Combo = Full Body + Segmental) asks which session this is.
export function AssignSportMassageDialog({ target, onClose, onSaved }: Props) {
  const [view, setView]                = useState<DialogView>('search')

  const [results, setResults]          = useState<PatientPlain[]>([])
  const [searching, setSearching]      = useState(false)
  const [search, setSearch]            = useState('')
  const [selectedPatient, setSelected] = useState<PatientPlain | null>(null)
  const searchRef                      = useRef<HTMLInputElement>(null)

  const [visitTime, setVisitTime]      = useState(
    `${String(target.hour).padStart(2, '0')}:${String(target.minute ?? 0).padStart(2, '0')}`)
  // Length of this visit; follows the chosen service until the admin overrides it
  const [durationOverride, setDurationOverride] = useState<number | null>(null)
  const [chiefComplaint, setChief]     = useState('')
  const [status] = useState<VisitStatus>('scheduled')
  const [notes, setNotes]              = useState('')

  // Sport Massage service types (internal_layanan rows) for this branch
  const [layananList, setLayananList]  = useState<LayananRow[]>([])
  const [paketList, setPaketList]      = useState<LayananRow[]>([])
  const [layananLoading, setLayananLoading] = useState(!!target.branchId)
  const [layananId, setLayananId]      = useState<string | null>(null)

  // Active Sport Massage package with sessions left → link the booking to it
  const [smPackage, setSmPackage]      = useState<PatientPackage | null>(null)
  const [usePackage, setUsePackage]    = useState(true)
  // Itemised package (Combo): which session kind this visit is
  const [pkgKinds, setPkgKinds]        = useState<PackageSessionKind[]>([])
  const [kindId, setKindId]            = useState<string | null>(null)

  // Package just bought from this dialog → record its payment before closing
  const [boughtPkg, setBoughtPkg]      = useState<{ id: string; layanan: LayananRow } | null>(null)

  const [saving, setSaving]            = useState(false)
  const [error, setError]              = useState<string | null>(null)

  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 100)
  }, [])

  useEffect(() => {
    if (!target.branchId) return
    let cancelled = false
    Promise.all([
      fetchSportMassageLayanan(target.branchId),
      fetchSportMassagePackageLayanan(target.branchId),
    ]).then(([rows, pakets]) => {
      if (cancelled) return
      setLayananList(rows)
      setPaketList(pakets)
      if (rows.length === 1 && pakets.length === 0) setLayananId(rows[0].id)
      setLayananLoading(false)
    })
    return () => { cancelled = true }
  }, [target.branchId])

  useEffect(() => {
    const q = search.trim()
    const t = setTimeout(() => {
      if (q.length < 2) { setResults([]); setSearching(false); return }
      setSearching(true)
      searchPatients(q).then((r) => { setResults(r); setSearching(false) })
    }, q.length < 2 ? 0 : 300)
    return () => clearTimeout(t)
  }, [search])

  function handleSelectPatient(p: PatientPlain) {
    setSelected(p)
    setView('details')
    setSmPackage(null)
    setPkgKinds([])
    setKindId(null)
    fetchPatientPackages(p.id).then(async (pkgs) => {
      const active = pkgs.find((k) =>
        k.status === 'active' && k.category === 'PAKET SPORT MASSAGE' && k.booked_sessions < k.total_sessions)
      const kinds = active ? await fetchPackageSessionKinds(active.id) : []
      setSmPackage(active ?? null)
      setUsePackage(true)
      setPkgKinds(kinds)
      setKindId(kinds.find((k) => k.booked < k.total)?.layanan_id ?? null)
    })
  }

  function selectLayanan(id: string) {
    setLayananId(id)
    setError(null)
    setDurationOverride(null)
    // Buying an itemised package: preselect its first session kind
    const paket = paketList.find((l) => l.id === id)
    if (paket) setKindId(Object.keys(paket.paket_komposisi ?? {})[0] ?? null)
  }

  function handleClearPatient() {
    setSelected(null)
    setView('search')
  }

  const usingPackage = !!(smPackage && usePackage)
  const buyingPaket  = !usingPackage ? paketList.find((l) => l.id === layananId) ?? null : null
  // Session kinds of the package this visit draws from (existing, or being bought)
  const kinds: PackageSessionKind[] = usingPackage
    ? pkgKinds
    : buyingPaket
      ? Object.entries(buyingPaket.paket_komposisi ?? {}).flatMap(([id, n]) => {
          const l = layananList.find((r) => r.id === id)
          return l ? [{ layanan_id: id, nama: l.nama, durasi_menit: l.durasi_menit ?? DEFAULT_VISIT_MINUTES, total: Number(n) || 0, booked: 0 }] : []
        })
      : []
  const kind = kinds.find((k) => k.layanan_id === kindId) ?? null
  // The session Layanan this visit is (payroll counts by it)
  const sessionLayananId = usingPackage || buyingPaket ? (kind?.layanan_id ?? null) : layananId
  const serviceMinutes = kind?.durasi_menit
    ?? layananList.find((l) => l.id === sessionLayananId)?.durasi_menit
    ?? DEFAULT_VISIT_MINUTES
  const duration = durationOverride ?? serviceMinutes

  async function handleSave() {
    if (!selectedPatient) return
    if (!target.branchId) {
      setError('Terapis tidak memiliki branch. Hubungi HR.')
      return
    }
    if (!usingPackage && layananList.length + paketList.length > 0 && !layananId) {
      setError('Pilih jenis layanan Sport Massage.')
      return
    }
    if (kinds.length > 0 && !kind) {
      setError('Pilih jenis sesi dari paket.')
      return
    }
    setSaving(true)
    setError(null)

    // Buying a package: create it first, this visit is its first session.
    const paket = buyingPaket
    let pkgId = usingPackage ? smPackage!.id : null
    if (paket) {
      const { id, error: pkgErr } = await createPackageFromLayanan({
        patient_id: selectedPatient.id,
        branch_id:  target.branchId,
        layanan_id: paket.id,
        category:   'PAKET SPORT MASSAGE',
      })
      if (pkgErr || !id) {
        setSaving(false)
        setError(pkgErr ?? 'Gagal membuat paket.')
        return
      }
      pkgId = id
    }

    const { error: err } = await createVisit({
      patient_id:         selectedPatient.id,
      branch_id:          target.branchId,
      attending_staff_id: target.staffId,
      service_type:       'SPORT MASSAGE',
      shift:              target.shift ?? null,
      visit_date:         target.date,
      visit_time:         visitTime || null,
      chief_complaint:    chiefComplaint.trim() || null,
      status,
      notes:              notes.trim() || null,
      package_id:         pkgId,
      layanan_id:         sessionLayananId,
      duration_minutes:   duration,
    })
    setSaving(false)
    if (err) {
      // Don't leave an empty, unpaid package behind.
      if (paket && pkgId) await deletePatientPackage(pkgId)
      setError(err)
      return
    }
    if (paket && pkgId) { setBoughtPkg({ id: pkgId, layanan: paket }); return }
    onSaved()
  }

  function renderOption(l: LayananRow, sub?: string) {
    const selected = l.id === layananId
    return (
      <button
        key={l.id}
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => selectLayanan(l.id)}
        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
          selected
            ? 'border-primary bg-primary/10'
            : 'border-border/40 bg-white/5 hover:bg-white/10'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
            selected ? 'border-primary bg-primary text-white' : 'border-border'
          }`}>
            {selected && <Check size={10} />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm text-foreground truncate">{l.nama}</span>
            {sub && <span className="block text-[11px] text-muted-foreground">{sub}</span>}
          </span>
        </span>
        <span className="text-xs font-semibold text-foreground shrink-0">{fmtRp(Number(l.harga))}</span>
      </button>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div role="dialog" aria-label="Tambah kunjungan Sport Massage" className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="glass-card w-full max-w-lg h-[70vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3 p-5 border-b border-border/30 shrink-0">
            <div>
              <h2 className="text-base font-semibold text-foreground">Tambah Kunjungan Sport Massage</h2>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User size={11} />
                  <span className="font-medium text-foreground">{target.staffName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock size={11} />
                  <span>{visitTime}–{endTime(visitTime, duration)}</span>
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

          <div className="flex-1 overflow-y-auto p-5">
            {view === 'search' && (
              <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
                <PatientSearch
                  search={search}
                  setSearch={setSearch}
                  results={results}
                  searching={searching}
                  searchRef={searchRef}
                  onSelect={handleSelectPatient}
                />
              </div>
            )}

            {view === 'details' && selectedPatient && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-1 duration-200">
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-border/30">
                  <span className="text-sm font-medium text-foreground">{selectedPatient.name}</span>
                  <button
                    onClick={handleClearPatient}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    Ganti
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Jam Mulai</label>
                    <input
                      type="time"
                      step={900}
                      value={visitTime}
                      onChange={(e) => setVisitTime(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Durasi <span className="font-normal text-muted-foreground">· selesai {visitTime ? endTime(visitTime, duration) : '—'}</span>
                    </label>
                    <div role="radiogroup" className="flex gap-1.5">
                      {[...new Set([60, 90, 120, serviceMinutes])].sort((a, b) => a - b).map((m) => (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={duration === m}
                          onClick={() => setDurationOverride(m === serviceMinutes ? null : m)}
                          className={`flex-1 py-2.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                            duration === m
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border/40 bg-white/5 text-muted-foreground hover:bg-white/10'
                          }`}
                        >
                          {m}′
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {smPackage && (
                  <label className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border border-primary/30 bg-primary/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={usePackage}
                      onChange={(e) => setUsePackage(e.target.checked)}
                      className="mt-0.5 accent-[var(--primary)]"
                    />
                    <span className="text-xs">
                      <span className="block font-semibold text-foreground">Pakai paket: {smPackage.package_name}</span>
                      <span className="text-muted-foreground">
                        Sesi ke-{smPackage.booked_sessions + 1} dari {smPackage.total_sessions}
                        {smPackage.order_id ? ` · ${smPackage.order_id}` : ''}
                      </span>
                    </span>
                  </label>
                )}

                {!(smPackage && usePackage) && (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Jenis Layanan</label>
                  {layananLoading ? (
                    <p className="text-xs text-muted-foreground">Memuat layanan...</p>
                  ) : layananList.length + paketList.length === 0 ? (
                    <p className="text-xs text-muted-foreground bg-white/5 px-3 py-2 rounded-xl">
                      Belum ada layanan Sport Massage aktif untuk cabang ini. Tambahkan di menu Layanan.
                    </p>
                  ) : (
                    <div role="radiogroup" className="space-y-3">
                      {layananList.length > 0 && (
                        <div className="space-y-1.5">
                          {paketList.length > 0 && (
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Sesi</p>
                          )}
                          {layananList.map((l) => renderOption(l))}
                        </div>
                      )}
                      {paketList.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            <Package size={11} /> Beli Paket
                          </p>
                          {paketList.map((l) => renderOption(l, `${l.jumlah_sesi || 1} sesi · kunjungan ini sesi ke-1`))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )}

                {kinds.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Sesi dari paket</label>
                    <div role="radiogroup" className="grid grid-cols-2 gap-1.5">
                      {kinds.map((k) => {
                        const left = k.total - k.booked
                        const selected = k.layanan_id === kindId
                        return (
                          <button
                            key={k.layanan_id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={left <= 0}
                            onClick={() => { setKindId(k.layanan_id); setDurationOverride(null); setError(null) }}
                            className={`px-3 py-2.5 rounded-xl border text-left transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              selected
                                ? 'border-primary bg-primary/10'
                                : 'border-border/40 bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <span className="block text-sm text-foreground truncate">{k.nama.replace(/^Sesi\s+/i, '')}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {k.durasi_menit} menit · sisa {Math.max(0, left)}/{k.total}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <VisitFields
                  chiefComplaint={chiefComplaint}
                  setChiefComplaint={setChief}
                  notes={notes}
                  setNotes={setNotes}
                />

                {error && (
                  <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="p-5 border-t border-border/30 flex gap-3 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
            >
              Batal
            </button>
            {view === 'details' && selectedPatient && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {saving ? 'Menyimpan...' : buyingPaket ? 'Simpan & Bayar Paket' : 'Simpan Kunjungan'}
              </button>
            )}
          </div>
        </div>
      </div>

      {boughtPkg && selectedPatient && (
        <PaketPaymentStep
          patientId={selectedPatient.id}
          patientName={selectedPatient.name}
          packageId={boughtPkg.id}
          packageName={boughtPkg.layanan.nama}
          jumlahSesi={boughtPkg.layanan.jumlah_sesi || 1}
          hargaDefault={Number(boughtPkg.layanan.harga)}
          category="PAKET SPORT MASSAGE"
          branchId={target.branchId}
          defaultFisioId={target.staffId}
          onDone={onSaved}
        />
      )}
    </>
  )
}
