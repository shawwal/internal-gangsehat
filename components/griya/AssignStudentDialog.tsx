'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Search, UserPlus } from 'lucide-react'
import { searchPatients, addPatient, type PatientPlain } from '@/app/actions/patients'
import { assignRecurringSlot, addSubstitute } from '@/app/actions/griyaJadwal'
import { PackageForm } from '@/components/jadwal/buy-package/PackageForm'
import { HARI_LABEL } from './constants'
import { GRIYA_SERVICE_TYPES, type CellTarget } from './types'

interface Props {
  target: CellTarget
  mode: 'assign' | 'substitute'
  onClose: () => void
  onSaved: () => void
}

export function AssignStudentDialog({ target, mode, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<'search' | 'new'>('search')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<PatientPlain[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<PatientPlain | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // new-child form
  const [nName, setNName] = useState('')
  const [nPhone, setNPhone] = useState('')
  const [nGender, setNGender] = useState<'male' | 'female'>('male')

  // slot options
  const [serviceType, setServiceType] = useState<string>('SESI TERAPI')
  const [startDate, setStartDate] = useState(target.dateIso)
  const [onlyThisWeek, setOnlyThisWeek] = useState(mode === 'substitute')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [buyingPackage, setBuyingPackage] = useState(false)

  useEffect(() => { setTimeout(() => searchRef.current?.focus(), 80) }, [])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setResults([]); return }
    setSearching(true)
    const t = setTimeout(() => {
      searchPatients(term).then((r) => { setResults(r); setSearching(false) })
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  async function save() {
    setSaving(true); setError(null)

    let patientId = picked?.id ?? null
    let patientName = picked?.name ?? ''
    if (tab === 'new') {
      if (!nName.trim() || !nPhone.trim()) { setError('Nama dan No. WA wajib diisi.'); setSaving(false); return }
      const { id, error: e } = await addPatient({ name: nName.trim(), phone: nPhone.trim(), gender: nGender })
      if (e || !id) { setError(e ?? 'Gagal menambah anak.'); setSaving(false); return }
      patientId = id
      patientName = nName.trim()
    }
    if (!patientId) { setError('Pilih anak dulu.'); setSaving(false); return }

    if (mode === 'substitute') {
      const { error: e } = await addSubstitute({
        branch_id: target.branchId,
        patient_id: patientId,
        therapist_id: target.therapistId,
        date: target.dateIso,
        slot_time: target.hour,
        service_type: serviceType,
        coveringName: target.slot?.patient_name ?? null,
      })
      setSaving(false)
      if (e) { setError(e); return }
      onSaved()
      return
    }

    const { error: e } = await assignRecurringSlot({
      branch_id: target.branchId,
      patient_id: patientId,
      therapist_id: target.therapistId,
      discipline: target.discipline,
      hari: target.hari,
      slot_time: target.hour,
      service_type: serviceType,
      start_date: startDate,
      onlyThisWeek: onlyThisWeek ? { date: target.dateIso } : null,
    })
    setSaving(false)
    if (e) { setError(e); return }
    onSaved()
    void patientName
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-2xl max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-border/30">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {mode === 'substitute' ? 'Cari Pengganti' : 'Tambah Anak ke Jadwal'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {target.therapistName} · {HARI_LABEL[target.hari]} {target.hour}
            </p>
          </div>
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
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Layanan</label>
              <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary">
                {GRIYA_SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {picked && (
              <button
                type="button"
                onClick={() => setBuyingPackage(true)}
                className="text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                + Beli paket untuk {picked.name.split(' ')[0]}
              </button>
            )}

            {mode === 'assign' && (
              <>
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="checkbox" checked={onlyThisWeek} onChange={(e) => setOnlyThisWeek(e.target.checked)} />
                  Hanya minggu ini (tidak berulang)
                </label>
                {!onlyThisWeek && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Berlaku mulai</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                )}
              </>
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
        <div className="fixed inset-0 z-[55] bg-black/50 flex items-center justify-center p-4" onClick={() => setBuyingPackage(false)}>
          <div className="glass-card w-full max-w-md max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-foreground mb-3">Beli Paket — {picked.name}</h3>
            <PackageForm
              patientId={picked.id}
              patientName={picked.name}
              branchId={target.branchId}
              lockedCategory="PAKET KLINIK"
              onCancel={() => setBuyingPackage(false)}
              onSuccess={() => setBuyingPackage(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
