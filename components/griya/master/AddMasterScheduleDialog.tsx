'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Search, UserPlus } from 'lucide-react'
import { addPatient } from '@/app/actions/patients'
import { searchGriyaStudents, type GriyaStudentOption } from '@/app/actions/griyaStudents'
import { assignRecurringSlot, moveSlot, type Discipline, type Hari, type GriyaTherapist } from '@/app/actions/griyaJadwal'
import { fetchLayananByBranch, type LayananRow } from '@/app/actions/layanan'
import { fetchPatientPackages } from '@/app/actions/packages'
import type { PatientPackage } from '@/types'
import { PackageSelector } from '@/components/jadwal/assign/PackageSelector'
import { GriyaBuyPackageDialog } from '../GriyaBuyPackageDialog'
import { CATEGORY_TO_SERVICE_TYPE } from '@/lib/serviceType'
import { GRIYA_HOURS, HARI_ORDER, HARI_LABEL, DISCIPLINES, DISCIPLINE_LABEL, toIso } from '../constants'
import { GRIYA_SERVICE_TYPES } from '../types'

function rp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

interface Props {
  branchId: string
  initialHari?: Hari
  initialHour?: string
  initialDiscipline?: Discipline
  onClose: () => void
  onSaved: () => void
  /** Only meaningful together with `therapists` — lets jadwal harian pin a specific
   *  therapist for this recurring slot instead of leaving it to daily rotation. */
  allowTherapistPin?: boolean
  therapists?: GriyaTherapist[]
  initialTherapistId?: string | null
  /** The date currently being viewed on jadwal harian — enables "hari ini saja". */
  initialDateIso?: string
}

// Weekly Schedule (MASTER): Day + Time + Patient + Service, plus therapist ONLY
// when opened from jadwal harian (allowTherapistPin) — otherwise the therapist is
// resolved daily by rotation (lib/griyaRotation.ts). Can be opened pre-filled from
// a grid cell (Jadwal Griya Anak / Jadwal Mingguan) or blank from the Jadwal Master page.
export function AddMasterScheduleDialog({
  branchId, initialHari, initialHour, initialDiscipline, onClose, onSaved,
  allowTherapistPin = false, therapists = [], initialTherapistId = null, initialDateIso,
}: Props) {
  const [tab, setTab] = useState<'search' | 'new'>('search')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<GriyaStudentOption[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<GriyaStudentOption | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const [nName, setNName] = useState('')
  const [nPhone, setNPhone] = useState('')
  const [nGender, setNGender] = useState<'male' | 'female'>('male')

  const [discipline, setDiscipline] = useState<Discipline>(initialDiscipline ?? 'FISIOTERAPI')
  const [hari, setHari] = useState<Hari>(initialHari ?? 'SENIN')
  const [hour, setHour] = useState(initialHour ?? GRIYA_HOURS[0])
  const [startDate, setStartDate] = useState(toIso(new Date()))
  const [therapistId, setTherapistId] = useState<string>(initialTherapistId ?? '')
  const [pinScope, setPinScope] = useState<'recurring' | 'once'>('recurring')

  const therapistOptions = therapists.filter((t) => t.discipline === discipline && t.is_active)
  useEffect(() => {
    if (therapistId && !therapistOptions.some((t) => t.therapist_id === therapistId)) setTherapistId('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discipline])

  // "Hari ini saja" only makes sense while the day dropdown still matches the day
  // being viewed — a pin for e.g. Wednesday can't be scoped to "today" if today's Monday.
  const canPinOnce = !!initialDateIso && hari === (initialHari ?? hari)
  useEffect(() => {
    if (!canPinOnce && pinScope === 'once') setPinScope('recurring')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPinOnce])

  const [serviceType, setServiceType] = useState<string>('SESI TERAPI')
  const [layanan, setLayanan] = useState<LayananRow[]>([])
  const [layananId, setLayananId] = useState<string>('')

  const [packages, setPackages] = useState<PatientPackage[]>([])
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null)
  const [pkgLoading, setPkgLoading] = useState(false)
  const [buyingPackage, setBuyingPackage] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setTimeout(() => searchRef.current?.focus(), 80) }, [])
  useEffect(() => { fetchLayananByBranch(branchId).then((rows) => setLayanan(rows.filter((r) => r.is_active))) }, [branchId])

  function loadPackages(patientId: string, autoSelect?: string) {
    setPkgLoading(true)
    fetchPatientPackages(patientId).then((pkgs) => {
      setPackages(pkgs)
      setPkgLoading(false)
      if (autoSelect) setSelectedPkgId(autoSelect)
      else if (pkgs.filter((p) => p.status === 'active').length === 1) {
        setSelectedPkgId(pkgs.find((p) => p.status === 'active')!.id)
      }
    })
  }

  const pickedId = picked?.id ?? null
  useEffect(() => {
    if (!pickedId) { setPackages([]); setSelectedPkgId(null); return }
    let live = true
    setPkgLoading(true)
    fetchPatientPackages(pickedId).then((pkgs) => {
      if (!live) return
      setPackages(pkgs)
      setPkgLoading(false)
      const actives = pkgs.filter((p) => p.status === 'active')
      if (actives.length === 1) setSelectedPkgId(actives[0].id)
    })
    return () => { live = false }
  }, [pickedId])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setResults([]); return }
    setSearching(true)
    const t = setTimeout(() => {
      searchGriyaStudents(term, branchId).then((r) => { setResults(r); setSearching(false) })
    }, 300)
    return () => clearTimeout(t)
  }, [q, branchId])

  async function save() {
    setSaving(true); setError(null)

    let patientId = picked?.id ?? null
    if (tab === 'new') {
      if (!nName.trim() || !nPhone.trim()) { setError('Nama dan No. WA wajib diisi.'); setSaving(false); return }
      const { id, error: e } = await addPatient({ name: nName.trim(), phone: nPhone.trim(), gender: nGender })
      if (e || !id) { setError(e ?? 'Gagal menambah anak.'); setSaving(false); return }
      patientId = id
    }
    if (!patientId) { setError('Pilih anak dulu.'); setSaving(false); return }

    const pinRecurring = allowTherapistPin && therapistId && pinScope === 'recurring'
    const pinOnce = allowTherapistPin && therapistId && pinScope === 'once' && canPinOnce

    const { error: e, id } = await assignRecurringSlot({
      branch_id: branchId,
      patient_id: patientId,
      discipline,
      hari,
      slot_time: hour,
      service_type: serviceType,
      package_id: selectedPkgId,
      start_date: startDate,
      therapist_id: pinRecurring ? therapistId : null,
    })
    if (e) { setSaving(false); setError(e); return }

    if (pinOnce && id) {
      const { error: moveError } = await moveSlot({ slotId: id, therapist_id: therapistId, slot_time: hour, date: initialDateIso! })
      setSaving(false)
      if (moveError) { setError(moveError); return }
    } else {
      setSaving(false)
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-2xl max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-border/30">
          <h2 className="text-base font-semibold text-foreground">Tambah Jadwal Master</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex gap-2">
            {(['search', 'new'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                  tab === t ? 'bg-primary/10 text-primary border-primary/40' : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {t === 'search' ? <Search size={13} /> : <UserPlus size={13} />}
                {t === 'search' ? 'Cari anak' : 'Anak baru'}
              </button>
            ))}
          </div>

          {tab === 'search' ? (
            <>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setPicked(null) }}
                  placeholder="Ketik nama anak..."
                  className="w-full pl-8 pr-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {picked ? (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/30">
                  <span className="text-sm font-medium text-foreground">{picked.name}</span>
                  <button onClick={() => setPicked(null)} className="text-xs text-primary cursor-pointer">ganti</button>
                </div>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {searching && <p className="text-xs text-muted-foreground px-1">Mencari...</p>}
                  {!searching && q.trim().length >= 2 && results.length === 0 && (
                    <p className="text-xs text-muted-foreground px-1">
                      Tidak ada siswa Griya Anak dengan nama itu. Anak baru? Pakai tab &quot;Anak baru&quot;.
                    </p>
                  )}
                  {results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPicked(p)}
                      className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-muted cursor-pointer"
                    >
                      {p.name}
                      {p.no_rm && <span className="text-xs text-muted-foreground ml-2">{p.no_rm}</span>}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Nama anak"
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
              <input value={nPhone} onChange={(e) => setNPhone(e.target.value)} placeholder="No. WA orang tua"
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
              <div className="grid grid-cols-2 gap-2">
                {(['male', 'female'] as const).map((g) => (
                  <button key={g} onClick={() => setNGender(g)}
                    className={`py-2 rounded-xl text-sm font-medium border cursor-pointer ${nGender === g ? 'bg-primary/10 text-primary border-primary/40' : 'border-border text-foreground hover:bg-muted'}`}>
                    {g === 'male' ? 'Laki-laki' : 'Perempuan'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3 pt-3 border-t border-border/30">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Hari</label>
                <select value={hari} onChange={(e) => setHari(e.target.value as Hari)}
                  className="w-full px-2.5 py-2 border border-border rounded-xl text-sm bg-input">
                  {HARI_ORDER.map((h) => <option key={h} value={h}>{HARI_LABEL[h]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Jam</label>
                <select value={hour} onChange={(e) => setHour(e.target.value)}
                  className="w-full px-2.5 py-2 border border-border rounded-xl text-sm bg-input">
                  {GRIYA_HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Layanan</label>
                <select value={discipline} onChange={(e) => setDiscipline(e.target.value as Discipline)}
                  className="w-full px-2.5 py-2 border border-border rounded-xl text-sm bg-input">
                  {DISCIPLINES.map((d) => <option key={d} value={d}>{DISCIPLINE_LABEL[d]}</option>)}
                </select>
              </div>
            </div>

            {allowTherapistPin && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Terapis</label>
                <select value={therapistId} onChange={(e) => setTherapistId(e.target.value)}
                  className="w-full px-2.5 py-2 border border-border rounded-xl text-sm bg-input">
                  <option value="">Auto (ikuti rotasi)</option>
                  {therapistOptions.map((t) => (
                    <option key={t.therapist_id} value={t.therapist_id}>{t.nickname || t.full_name}</option>
                  ))}
                </select>

                {therapistId && (
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Berlaku untuk</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setPinScope('recurring')}
                        className={`py-2 rounded-xl text-sm font-medium border cursor-pointer ${pinScope === 'recurring' ? 'bg-primary/10 text-primary border-primary/40' : 'border-border text-foreground hover:bg-muted'}`}>
                        Rutin (semua minggu)
                      </button>
                      <button type="button" disabled={!canPinOnce} onClick={() => setPinScope('once')}
                        title={canPinOnce ? undefined : 'Hanya tersedia jika Hari yang dipilih sama dengan hari yang sedang dibuka'}
                        className={`py-2 rounded-xl text-sm font-medium border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${pinScope === 'once' ? 'bg-primary/10 text-primary border-primary/40' : 'border-border text-foreground hover:bg-muted'}`}>
                        Hari ini saja
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {pinScope === 'recurring'
                        ? 'Terapis ini akan menangani jadwal ini setiap minggu, kecuali rotasi harian menandainya cuti/tidak aktif.'
                        : 'Jadwal tetap dibuat mengikuti rotasi harian mulai minggu berikutnya — hanya untuk hari ini yang ditangani terapis ini.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Berlaku mulai</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Kategori Kunjungan</label>
              {layanan.length > 0 ? (
                <select
                  value={layananId}
                  onChange={(e) => {
                    setLayananId(e.target.value)
                    const row = layanan.find((l) => l.id === e.target.value)
                    if (row) setServiceType(CATEGORY_TO_SERVICE_TYPE[row.kategori] ?? 'LAINNYA')
                  }}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">— pilih layanan —</option>
                  {Array.from(new Set(layanan.map((l) => l.kategori))).map((kat) => (
                    <optgroup key={kat} label={kat}>
                      {layanan.filter((l) => l.kategori === kat).map((l) => (
                        <option key={l.id} value={l.id}>{l.nama} · {rp(l.harga)}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              ) : (
                <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary">
                  {GRIYA_SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>

            {picked && (
              <div className="space-y-1.5">
                <PackageSelector
                  packages={packages}
                  pkgLoading={pkgLoading}
                  selectedPkgId={selectedPkgId}
                  setSelectedPkgId={setSelectedPkgId}
                  willCreate={0}
                />
                <button
                  type="button"
                  onClick={() => setBuyingPackage(true)}
                  className="text-xs font-medium text-primary hover:underline cursor-pointer"
                >
                  + Beli paket untuk {picked.name.split(' ')[0]}
                </button>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="p-5 border-t border-border/30 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">Batal</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>

      {buyingPackage && picked && (
        <GriyaBuyPackageDialog
          patientId={picked.id}
          patientName={picked.name}
          branchId={branchId}
          onClose={() => setBuyingPackage(false)}
          onDone={(pkgId) => { setBuyingPackage(false); loadPackages(picked.id, pkgId) }}
        />
      )}
    </div>
  )
}
