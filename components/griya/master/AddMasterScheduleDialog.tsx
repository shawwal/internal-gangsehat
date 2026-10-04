'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Search, UserPlus, Repeat, CalendarCheck } from 'lucide-react'
import { addPatient } from '@/app/actions/patients'
import { searchGriyaStudents, type GriyaStudentOption } from '@/app/actions/griyaStudents'
import { assignRecurringSlot, addSubstitute, type Discipline, type Hari, type GriyaTherapist } from '@/app/actions/griyaJadwal'
import { fetchLayananByBranch, type LayananRow } from '@/app/actions/layanan'
import { fetchPatientPackages } from '@/app/actions/packages'
import type { PatientPackage } from '@/types'
import { PackageSelector } from '@/components/jadwal/assign/PackageSelector'
import { GriyaBuyPackageDialog } from '../GriyaBuyPackageDialog'
import { CATEGORY_TO_SERVICE_TYPE } from '@/lib/serviceType'
import { GRIYA_HOURS, HARI_ORDER, HARI_LABEL, DISCIPLINES, DISCIPLINE_LABEL, toIso, hariOf } from '../constants'
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
  /** The date of the clicked cell (jadwal harian / mingguan). Together with
   *  `therapists` it enables "Sekali saja (1 sesi)". */
  initialDateIso?: string
}

// Two kinds of booking:
//  • Rutin mingguan — a MASTER row (griya_schedule_slots): Day + Time + Patient +
//    Service, plus an optional therapist pin when opened from jadwal harian
//    (allowTherapistPin) — otherwise the therapist is resolved daily by rotation
//    (lib/griyaRotation.ts). Repeats every week until ended.
//  • Sekali saja (1 sesi) — a single patient_visits row for one date + therapist,
//    with NO master row, so it never repeats and deleting it removes it for good.
//    (This used to be a "hari ini saja" pin that still created a weekly master
//    row — the session kept coming back after being deleted.)
// Can be opened pre-filled from a grid cell or blank from the Jadwal Master page
// (recurring only there, since there's no date/therapist context).
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
  // Default to the viewed date, so a booking added while looking at another day
  // actually shows up on that day (resolveDay hides dates before start_date).
  const [startDate, setStartDate] = useState(initialDateIso ?? toIso(new Date()))
  const [therapistId, setTherapistId] = useState<string>(initialTherapistId ?? '')

  const canOnce = !!initialDateIso && therapists.length > 0
  const [mode, setMode] = useState<'recurring' | 'once'>('recurring')
  const [onceDate, setOnceDate] = useState(initialDateIso ?? toIso(new Date()))
  const showTherapist = mode === 'once' || allowTherapistPin

  const therapistOptions = therapists.filter((t) => t.discipline === discipline && t.is_active)
  useEffect(() => {
    if (therapistId && !therapistOptions.some((t) => t.therapist_id === therapistId)) setTherapistId('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discipline])

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

    if (mode === 'once') {
      if (!therapistId) { setError('Pilih terapis untuk sesi ini.'); setSaving(false); return }
      if (!onceDate) { setError('Tanggal wajib diisi.'); setSaving(false); return }
    }

    let patientId = picked?.id ?? null
    if (tab === 'new') {
      if (!nName.trim() || !nPhone.trim()) { setError('Nama dan No. WA wajib diisi.'); setSaving(false); return }
      const { id, error: e } = await addPatient({ name: nName.trim(), phone: nPhone.trim(), gender: nGender })
      if (e || !id) { setError(e ?? 'Gagal menambah anak.'); setSaving(false); return }
      patientId = id
      // If the booking below fails, a retry must reuse this child, not create another.
      setPicked({ id, name: nName.trim(), no_rm: null })
      setTab('search')
    }
    if (!patientId) { setError('Pilih anak dulu.'); setSaving(false); return }

    if (mode === 'once') {
      const { error: e } = await addSubstitute({
        branch_id: branchId,
        patient_id: patientId,
        therapist_id: therapistId,
        date: onceDate,
        slot_time: hour,
        service_type: serviceType,
        layanan_id: layananId || null,
        package_id: selectedPkgId,
        kind: 'once',
      })
      setSaving(false)
      if (e) { setError(e); return }
      onSaved()
      return
    }

    const { error: e } = await assignRecurringSlot({
      branch_id: branchId,
      patient_id: patientId,
      discipline,
      hari,
      slot_time: hour,
      service_type: serviceType,
      package_id: selectedPkgId,
      start_date: startDate,
      therapist_id: allowTherapistPin && therapistId ? therapistId : null,
    })
    setSaving(false)
    if (e) { setError(e); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-2xl max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-border/30">
          <h2 className="text-base font-semibold text-foreground">{mode === 'once' ? 'Tambah Sesi (1x)' : 'Tambah Jadwal Rutin'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {canOnce && (
            <div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'recurring', label: 'Rutin mingguan', icon: <Repeat size={14} /> },
                  { key: 'once', label: 'Sekali saja (1 sesi)', icon: <CalendarCheck size={14} /> },
                ] as const).map((o) => (
                  <button key={o.key} type="button" onClick={() => setMode(o.key)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border cursor-pointer ${
                      mode === o.key ? 'bg-primary/10 text-primary border-primary/40' : 'border-border text-foreground hover:bg-muted'
                    }`}>
                    {o.icon}{o.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {mode === 'once'
                  ? 'Hanya untuk tanggal ini — tidak berulang minggu depan dan tidak masuk Jadwal Master.'
                  : 'Berulang setiap minggu di hari & jam yang sama sampai jadwal diakhiri.'}
              </p>
            </div>
          )}

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
              {mode === 'once' ? (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Tanggal{onceDate && <span className="font-normal"> · {HARI_LABEL[hariOf(new Date(onceDate + 'T00:00:00'))]}</span>}
                  </label>
                  <input type="date" value={onceDate} onChange={(e) => setOnceDate(e.target.value)}
                    className="w-full px-2.5 py-2 border border-border rounded-xl text-sm bg-input" />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Hari</label>
                  <select value={hari} onChange={(e) => setHari(e.target.value as Hari)}
                    className="w-full px-2.5 py-2 border border-border rounded-xl text-sm bg-input">
                    {HARI_ORDER.map((h) => <option key={h} value={h}>{HARI_LABEL[h]}</option>)}
                  </select>
                </div>
              )}
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

            {showTherapist && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Terapis</label>
                <select value={therapistId} onChange={(e) => setTherapistId(e.target.value)}
                  className="w-full px-2.5 py-2 border border-border rounded-xl text-sm bg-input">
                  <option value="">{mode === 'once' ? '— pilih terapis —' : 'Auto (ikuti rotasi)'}</option>
                  {therapistOptions.map((t) => (
                    <option key={t.therapist_id} value={t.therapist_id}>{t.nickname || t.full_name}</option>
                  ))}
                </select>
                {mode === 'recurring' && therapistId && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Terapis ini akan menangani jadwal ini setiap minggu, kecuali rotasi harian menandainya cuti/tidak aktif.
                  </p>
                )}
              </div>
            )}

            {mode === 'recurring' && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Berlaku mulai</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            )}

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
