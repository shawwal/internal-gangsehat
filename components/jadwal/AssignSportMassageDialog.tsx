'use client'

import { useEffect, useState, useRef } from 'react'
import { X, User, Clock, Check } from 'lucide-react'
import { searchPatients, type PatientPlain } from '@/app/actions/patients'
import { createVisit } from '@/app/actions/jadwal'
import { fetchSportMassageLayanan, type LayananRow } from '@/app/actions/layanan'
import type { AssignTarget } from './types'
import type { VisitStatus } from '@/types'

import { fmtHour } from './assign/constants'
import { PatientSearch } from './assign/PatientSearch'
import { VisitFields } from './assign/VisitFields'

interface Props {
  target: AssignTarget
  onClose: () => void
  onSaved: () => void
}

type DialogView = 'search' | 'details'

function fmtRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

// Single-session Sport Massage booking — no package/recurring logic, unlike
// the regular AssignDialog. Sport massage is a standalone service booked
// per-visit with its own dedicated therapist role.
export function AssignSportMassageDialog({ target, onClose, onSaved }: Props) {
  const [view, setView]                = useState<DialogView>('search')

  const [results, setResults]          = useState<PatientPlain[]>([])
  const [searching, setSearching]      = useState(false)
  const [search, setSearch]            = useState('')
  const [selectedPatient, setSelected] = useState<PatientPlain | null>(null)
  const searchRef                      = useRef<HTMLInputElement>(null)

  const [visitTime, setVisitTime]      = useState(`${String(target.hour).padStart(2, '0')}:00`)
  const [chiefComplaint, setChief]     = useState('')
  const [status] = useState<VisitStatus>('scheduled')
  const [notes, setNotes]              = useState('')

  // Sport Massage service types (internal_layanan rows) for this branch
  const [layananList, setLayananList]  = useState<LayananRow[]>([])
  const [layananLoading, setLayananLoading] = useState(!!target.branchId)
  const [layananId, setLayananId]      = useState<string | null>(null)

  const [saving, setSaving]            = useState(false)
  const [error, setError]              = useState<string | null>(null)

  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 100)
  }, [])

  useEffect(() => {
    if (!target.branchId) return
    let cancelled = false
    fetchSportMassageLayanan(target.branchId).then((rows) => {
      if (cancelled) return
      setLayananList(rows)
      if (rows.length === 1) setLayananId(rows[0].id)
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
  }

  function handleClearPatient() {
    setSelected(null)
    setView('search')
  }

  async function handleSave() {
    if (!selectedPatient) return
    if (!target.branchId) {
      setError('Terapis tidak memiliki branch. Hubungi HR.')
      return
    }
    if (layananList.length > 0 && !layananId) {
      setError('Pilih jenis layanan Sport Massage.')
      return
    }
    setSaving(true)
    setError(null)

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
      package_id:         null,
      layanan_id:         layananId,
    })
    setSaving(false)
    if (err) { setError(err); return }
    onSaved()
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

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Jam Kunjungan</label>
                  <input
                    type="time"
                    value={visitTime}
                    onChange={(e) => setVisitTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Jenis Layanan</label>
                  {layananLoading ? (
                    <p className="text-xs text-muted-foreground">Memuat layanan...</p>
                  ) : layananList.length === 0 ? (
                    <p className="text-xs text-muted-foreground bg-white/5 px-3 py-2 rounded-xl">
                      Belum ada layanan Sport Massage aktif untuk cabang ini. Tambahkan di menu Layanan.
                    </p>
                  ) : (
                    <div role="radiogroup" className="space-y-1.5">
                      {layananList.map((l) => {
                        const selected = l.id === layananId
                        return (
                          <button
                            key={l.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => { setLayananId(l.id); setError(null) }}
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
                              <span className="text-sm text-foreground truncate">{l.nama}</span>
                            </span>
                            <span className="text-xs font-semibold text-foreground shrink-0">{fmtRp(Number(l.harga))}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

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
                {saving ? 'Menyimpan...' : 'Simpan Kunjungan'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
