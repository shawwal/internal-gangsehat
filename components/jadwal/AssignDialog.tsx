'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { X, User, Clock } from 'lucide-react'
import { searchPatients, type PatientPlain } from '@/app/actions/patients'
import { createVisit, createBulkVisits } from '@/app/actions/jadwal'
import { fetchPatientPackages } from '@/app/actions/packages'
import type { AssignTarget } from './types'
import type { PatientPackage, VisitStatus } from '@/types'

import { fmtHour, toIso } from './assign/constants'
import { PatientSearch } from './assign/PatientSearch'
import { PatientChip } from './assign/PatientChip'
import { ModeTabs, type VisitMode } from './assign/ModeTabs'
import { RecurringConfig } from './assign/RecurringConfig'
import { VisitFields } from './assign/VisitFields'
import { PackageSelector } from './assign/PackageSelector'

interface Props {
  target: AssignTarget
  onClose: () => void
  onSaved: () => void
}

type DialogView = 'search' | 'details'

export function AssignDialog({ target, onClose, onSaved }: Props) {
  // ── View ────────────────────────────────────────────────────────────────────
  const [view, setView]                  = useState<DialogView>('search')

  // ── Patient ─────────────────────────────────────────────────────────────────
  const [results, setResults]            = useState<PatientPlain[]>([])
  const [searching, setSearching]        = useState(false)
  const [search, setSearch]              = useState('')
  const [selectedPatient, setSelected]   = useState<PatientPlain | null>(null)
  const searchRef                        = useRef<HTMLInputElement>(null)

  // ── Visit details ────────────────────────────────────────────────────────────
  const [visitTime, setVisitTime]        = useState(`${String(target.hour).padStart(2, '0')}:00`)
  const [chiefComplaint, setChief]       = useState('')
  const [status, setStatus]              = useState<VisitStatus>('scheduled')
  const [notes, setNotes]                = useState('')

  // ── Mode ─────────────────────────────────────────────────────────────────────
  const [mode, setMode]                  = useState<VisitMode>('terapi_awal')

  // ── Recurring ────────────────────────────────────────────────────────────────
  const targetDow = useMemo(() => new Date(target.date + 'T00:00:00').getDay(), [target.date])
  const [recurDays, setRecurDays]        = useState<number[]>([targetDow])
  const [recurEnd, setRecurEnd]          = useState<string>(() => {
    const d = new Date(target.date + 'T00:00:00')
    d.setDate(d.getDate() + 27)
    return toIso(d)
  })

  // ── Packages ─────────────────────────────────────────────────────────────────
  const [packages, setPackages]          = useState<PatientPackage[]>([])
  const [pkgLoading, setPkgLoading]      = useState(false)
  const [selectedPkgId, setSelectedPkg]  = useState<string | null>(null)

  // ── Save state ────────────────────────────────────────────────────────────────
  const [saving, setSaving]              = useState(false)
  const [error, setError]                = useState<string | null>(null)

  // ── Focus search on open ──────────────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 100)
  }, [])

  // ── Debounced patient search ──────────────────────────────────────────────────
  useEffect(() => {
    const q = search.trim()
    const t = setTimeout(() => {
      if (q.length < 2) { setResults([]); setSearching(false); return }
      setSearching(true)
      searchPatients(q).then((r) => { setResults(r); setSearching(false) })
    }, q.length < 2 ? 0 : 300)
    return () => clearTimeout(t)
  }, [search])

  // ── Load packages on patient select ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedPatient) {
      setPackages([])
      setSelectedPkg(null)
      return
    }
    setPkgLoading(true)
    fetchPatientPackages(selectedPatient.id).then((pkgs) => {
      setPackages(pkgs)
      setSelectedPkg(pkgs.find((p) => p.status === 'active')?.id ?? null)
      setPkgLoading(false)
    })
  }, [selectedPatient])

  // ── Recurring dates ───────────────────────────────────────────────────────────
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

  const willCreate = mode === 'recurring' ? recurDates.length : 1

  // ── Handlers ──────────────────────────────────────────────────────────────────
  function handleSelectPatient(p: PatientPlain) {
    setSelected(p)
    setView('details')
  }

  function handleClearPatient() {
    setSelected(null)
    setView('search')
  }

  function toggleDay(dow: number) {
    setRecurDays((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow],
    )
  }

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

  // ── Save button label ─────────────────────────────────────────────────────────
  const saveLabel = saving
    ? 'Menyimpan...'
    : mode === 'recurring' && recurDates.length > 0
    ? `Simpan ${recurDates.length} Sesi`
    : mode === 'terapi_awal'
    ? 'Simpan Terapi Awal'
    : 'Simpan Kunjungan'

  // ── Render ────────────────────────────────────────────────────────────────────
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
                <PatientChip
                  patient={selectedPatient}
                  packages={packages}
                  pkgLoading={pkgLoading}
                  onClear={handleClearPatient}
                />

                <ModeTabs mode={mode} setMode={setMode} />

                {mode === 'recurring' && (
                  <RecurringConfig
                    targetDate={target.date}
                    recurDays={recurDays}
                    recurEnd={recurEnd}
                    recurDates={recurDates}
                    onToggleDay={toggleDay}
                    onSetEnd={setRecurEnd}
                  />
                )}

                <VisitFields
                  chiefComplaint={chiefComplaint}
                  setChiefComplaint={setChief}
                  notes={notes}
                  setNotes={setNotes}
                />

                {mode !== 'terapi_awal' && (
                  <PackageSelector
                    packages={packages}
                    pkgLoading={pkgLoading}
                    selectedPkgId={selectedPkgId}
                    setSelectedPkgId={setSelectedPkg}
                    willCreate={willCreate}
                  />
                )}

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
            {view === 'details' && selectedPatient && (
              <button
                onClick={handleSave}
                disabled={saving || (mode === 'recurring' && recurDates.length === 0)}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {saveLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
