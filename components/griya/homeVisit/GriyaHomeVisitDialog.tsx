'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Search, Package, Plus, Home } from 'lucide-react'
import { searchGriyaStudents, type GriyaStudentOption } from '@/app/actions/griyaStudents'
import { addSubstitute, markVisitAttendance } from '@/app/actions/griyaJadwal'
import { fetchGriyaHomeVisitTherapists, type GriyaHomeVisitTherapist } from '@/app/actions/griyaHomeVisit'
import { fetchLayananByBranch, type LayananRow } from '@/app/actions/layanan'
import { fetchPatientPackages } from '@/app/actions/packages'
import { ModalPortal } from '@/components/payment-links/ModalPortal'
import type { PatientPackage, ServiceType } from '@/types'
import { GriyaBuyPackageDialog } from '../GriyaBuyPackageDialog'
import { DISCIPLINE_LABEL, GRIYA_HOURS, toIso } from '../constants'
import { inputCls, labelCls } from '../StudentFormFields'

export interface GriyaHomeVisitCreated {
  id: string
  patient_id: string
  patient_name: string
  visit_date: string
  service_type: ServiceType
  layanan_id: string | null
  therapist_name: string | null
  /** Per-session tariff (not a package session) — the caller offers the payment dialog. */
  needsPayment: boolean
}

interface Props {
  branchId: string
  onClose: () => void
  onSaved: (created: GriyaHomeVisitCreated) => void
}

type Choice =
  | { kind: 'session'; serviceType: 'TERAPI AWAL VISIT' | 'SESI VISIT'; layanan: LayananRow }
  | { kind: 'package'; pkg: PatientPackage }

const rp = (n: number) => `Rp ${Number(n).toLocaleString('id-ID')}`

const SESSION_GROUPS: { serviceType: 'TERAPI AWAL VISIT' | 'SESI VISIT'; label: string; hint: string }[] = [
  { serviceType: 'TERAPI AWAL VISIT', label: 'Terapi Awal Visit', hint: 'Asesmen awal di rumah anak' },
  { serviceType: 'SESI VISIT', label: 'Sesi Visit', hint: 'Satu sesi, dibayar per kunjungan' },
]

export function GriyaHomeVisitDialog({ branchId, onClose, onSaved }: Props) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<GriyaStudentOption[]>([])
  const [searching, setSearching] = useState(false)
  const [child, setChild] = useState<GriyaStudentOption | null>(null)

  const [layanan, setLayanan] = useState<LayananRow[]>([])
  const [packages, setPackages] = useState<PatientPackage[]>([])
  const [therapists, setTherapists] = useState<GriyaHomeVisitTherapist[]>([])
  const [choice, setChoice] = useState<Choice | null>(null)
  const [buying, setBuying] = useState(false)

  const [therapistId, setTherapistId] = useState('')
  const [date, setDate] = useState(toIso(new Date()))
  const [hour, setHour] = useState('09:00')
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchLayananByBranch(branchId).then((rows) => setLayanan(rows.filter((r) => r.is_active)))
    fetchGriyaHomeVisitTherapists(branchId).then(setTherapists)
  }, [branchId])

  const term = q.trim()
  useEffect(() => {
    if (term.length < 2) return
    const t = setTimeout(() => {
      setSearching(true)
      searchGriyaStudents(term, branchId).then((r) => { setResults(r); setSearching(false) })
    }, 300)
    return () => clearTimeout(t)
  }, [term, branchId])
  const shownResults = term.length >= 2 ? results : []

  function loadPackages(patientId: string, select?: string) {
    fetchPatientPackages(patientId).then((pkgs) => {
      const visitPkgs = pkgs.filter((p) => p.category === 'PAKET VISIT' && p.status === 'active')
      setPackages(visitPkgs)
      const pick = visitPkgs.find((p) => p.id === select)
      if (pick) setChoice({ kind: 'package', pkg: pick })
    })
  }

  function pickChild(c: GriyaStudentOption | null) {
    setChild(c)
    setChoice(null)
    setPackages([])
    if (c) loadPackages(c.id)
  }

  const tariffs = useMemo(() => {
    const by = (k: string) => layanan.filter((l) => l.kategori === k).sort((a, b) => a.harga - b.harga)
    return { 'TERAPI AWAL VISIT': by('TERAPI AWAL VISIT'), 'SESI VISIT': by('SESI VISIT'), paket: by('PAKET VISIT') }
  }, [layanan])

  const isPast = date <= toIso(new Date())
  const therapist = therapists.find((t) => t.id === therapistId) ?? null

  async function save() {
    if (!child || !choice || !therapistId) return
    setSaving(true); setError(null)
    const serviceType: ServiceType = choice.kind === 'package' ? 'PAKET VISIT' : choice.serviceType
    const layananId = choice.kind === 'package' ? (choice.pkg.layanan_id ?? null) : choice.layanan.id
    const res = await addSubstitute({
      kind: 'home_visit',
      branch_id: branchId,
      patient_id: child.id,
      therapist_id: therapistId,
      date,
      slot_time: hour,
      service_type: serviceType,
      layanan_id: layananId,
      package_id: choice.kind === 'package' ? choice.pkg.id : null,
    })
    if (res.error || !res.id) { setSaving(false); setError(res.error ?? 'Gagal menyimpan kunjungan.'); return }
    if (done && isPast) {
      const att = await markVisitAttendance(res.id, { present: true })
      if (att.error) { setSaving(false); setError(`Kunjungan tersimpan, tapi gagal menandai hadir: ${att.error}`); return }
    }
    setSaving(false)
    onSaved({
      id: res.id,
      patient_id: child.id,
      patient_name: child.name,
      visit_date: date,
      service_type: serviceType,
      layanan_id: layananId,
      therapist_name: therapist?.name ?? null,
      needsPayment: choice.kind === 'session',
    })
  }

  const optionCls = (on: boolean) =>
    `w-full text-left px-3 py-2 rounded-xl border text-sm transition-colors cursor-pointer ${
      on ? 'border-primary bg-primary/10 text-foreground' : 'border-border hover:bg-muted'
    }`

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="glass-card w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between p-5 border-b border-border/30">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2"><Home size={16} className="text-primary" /> Home Visit Baru</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Jam terapis ikut terisi di Jadwal Griya Anak selama kunjungan.</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer" aria-label="Tutup"><X size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* 1. Anak */}
            <section className="space-y-2">
              <p className={labelCls}>1. Anak</p>
              {child ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-primary/40 bg-primary/5">
                  <span className="text-sm font-medium text-foreground">{child.name}{child.no_rm && <span className="text-xs text-muted-foreground"> · No. Rekam Medis {child.no_rm}</span>}</span>
                  <button className="text-xs text-primary hover:underline cursor-pointer" onClick={() => pickChild(null)}>Ganti</button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama siswa Griya Anak…" className={`${inputCls} pl-9`} />
                  </div>
                  {searching && <p className="text-xs text-muted-foreground">Mencari…</p>}
                  {!searching && term.length >= 2 && shownResults.length === 0 && (
                    <p className="text-xs text-muted-foreground">Tidak ditemukan. Daftarkan anak dulu di menu Siswa Griya Anak.</p>
                  )}
                  <div className="space-y-1">
                    {shownResults.map((r) => (
                      <button key={r.id} className={optionCls(false)} onClick={() => pickChild(r)}>
                        {r.name}{r.no_rm && <span className="text-xs text-muted-foreground"> · No. Rekam Medis {r.no_rm}</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>

            {/* 2. Layanan */}
            {child && (
              <section className="space-y-2">
                <p className={labelCls}>2. Layanan</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  {SESSION_GROUPS.map((g) => (
                    <div key={g.serviceType} className="rounded-2xl border border-border p-3 space-y-1.5">
                      <p className="text-sm font-semibold text-foreground">{g.label}</p>
                      <p className="text-[11px] text-muted-foreground">{g.hint}</p>
                      {tariffs[g.serviceType].length === 0 && <p className="text-[11px] text-muted-foreground italic">Belum ada tarif.</p>}
                      {tariffs[g.serviceType].map((l) => {
                        const on = choice?.kind === 'session' && choice.layanan.id === l.id
                        return (
                          <button key={l.id} className={optionCls(on)} onClick={() => setChoice({ kind: 'session', serviceType: g.serviceType, layanan: l })}>
                            <span className="block text-xs">{l.nama}</span>
                            <span className="block text-xs font-semibold text-primary">{rp(l.harga)}</span>
                          </button>
                        )
                      })}
                    </div>
                  ))}
                  <div className="rounded-2xl border-2 border-primary/50 p-3 space-y-1.5">
                    <p className="text-sm font-semibold text-foreground">Paket Visit</p>
                    <p className="text-[11px] text-muted-foreground">Potong satu sesi dari paket home visit aktif</p>
                    {packages.map((p) => {
                      const on = choice?.kind === 'package' && choice.pkg.id === p.id
                      const full = p.remaining_sessions <= 0
                      return (
                        <button key={p.id} disabled={full} className={`${optionCls(on)} disabled:opacity-50 disabled:cursor-not-allowed`}
                          onClick={() => setChoice({ kind: 'package', pkg: p })}>
                          <span className="flex items-center gap-1 text-xs"><Package size={12} /> {p.package_name}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {p.attended_sessions ?? p.used_sessions}/{p.total_sessions} terpakai · sisa {p.remaining_sessions}
                            {!p.payment_ok && ' · belum dibayar'}
                          </span>
                        </button>
                      )
                    })}
                    {tariffs.paket.length > 0 ? (
                      <button className="w-full flex items-center justify-center gap-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 cursor-pointer"
                        onClick={() => setBuying(true)}>
                        <Plus size={13} /> Beli paket home visit
                      </button>
                    ) : packages.length === 0 && <p className="text-[11px] text-muted-foreground italic">Belum ada tarif paket visit.</p>}
                  </div>
                </div>
              </section>
            )}

            {/* 3. Jadwal */}
            {child && choice && (
              <section className="space-y-3">
                <p className={labelCls}>3. Terapis & Waktu</p>
                <div>
                  <label className={labelCls}>Terapis</label>
                  <select value={therapistId} onChange={(e) => setTherapistId(e.target.value)} className={inputCls}>
                    <option value="">— pilih terapis —</option>
                    {therapists.map((t) => <option key={t.id} value={t.id}>{t.name} · {DISCIPLINE_LABEL[t.discipline]}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Tanggal</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Jam</label>
                    <select value={hour} onChange={(e) => setHour(e.target.value)} className={inputCls}>
                      {GRIYA_HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
                {isPast && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} />
                    Kunjungan sudah dilaksanakan — tandai <b>Hadir</b>
                  </label>
                )}
              </section>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="flex gap-2 p-5 border-t border-border/30">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">Batal</button>
            <button onClick={save} disabled={!child || !choice || !therapistId || saving}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
              {saving ? 'Menyimpan…' : 'Simpan Home Visit'}
            </button>
          </div>
        </div>
      </div>

      {buying && child && (
        <GriyaBuyPackageDialog
          patientId={child.id}
          patientName={child.name}
          branchId={branchId}
          categories={['PAKET VISIT']}
          onClose={() => setBuying(false)}
          onDone={(id) => { setBuying(false); loadPackages(child.id, id) }}
        />
      )}
    </ModalPortal>
  )
}
