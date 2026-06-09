'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchPatient } from '@/app/actions/patients'
import type { PatientVisit, VisitStatus, ServiceType, BodyRegion } from '@/types'

const STATUS_OPTIONS: VisitStatus[] = ['scheduled', 'completed', 'cancelled', 'no_show']
const STATUS_BADGE: Record<VisitStatus, string> = {
  scheduled: 'bg-secondary/20 text-secondary-foreground',
  completed: 'bg-chart-4/15 text-chart-4',
  cancelled: 'bg-destructive/10 text-destructive',
  no_show:   'bg-muted text-muted-foreground',
}
const STATUS_LABEL: Record<VisitStatus, string> = {
  scheduled: 'Terjadwal', completed: 'Selesai', cancelled: 'Dibatalkan', no_show: 'Tidak Hadir',
}

const SERVICE_TYPES: ServiceType[] = [
  'TERAPI AWAL', 'PAKET TERAPI', 'SESI TERAPI',
  'TA VISIT', 'SESI VISIT', 'PAKET VISIT', 'LAINNYA',
]

const BODY_REGIONS: BodyRegion[] = [
  'HEAD', 'NECK', 'SHOULDER', 'UPPER ARM', 'ELBOW', 'LOWER ARM',
  'WRIST', 'HAND', 'SPINE', 'CHEST', 'UPPER BACK', 'LOWER BACK',
  'ABDOMINAL', 'HIP/PELVIC', 'THIGH', 'KNEE', 'CALF', 'ANKLE',
  'FOOT', 'CNS', 'PNS', 'SYSTEMIC', 'CARDIOVASCULAR', 'PULMONAL', 'PERFORMANCE',
]

const SERVICE_BADGE: Record<ServiceType, string> = {
  'TERAPI AWAL':  'bg-primary/15 text-primary',
  'PAKET TERAPI': 'bg-chart-4/15 text-chart-4',
  'SESI TERAPI':  'bg-secondary/20 text-secondary-foreground',
  'TA VISIT':     'bg-primary/10 text-primary',
  'SESI VISIT':   'bg-muted text-muted-foreground',
  'PAKET VISIT':  'bg-chart-4/10 text-chart-4',
  'LAINNYA':      'bg-muted text-muted-foreground',
}

const DEFAULT_FORM = {
  visit_date:      new Date().toISOString().split('T')[0],
  service_type:    '' as ServiceType | '',
  shift:           '' as 'PAGI' | 'SORE' | '',
  kehadiran:       '' as 'HADIR' | 'TIDAK HADIR' | '',
  regio:           '' as BodyRegion | '',
  sumber_pasien:   '',
  chief_complaint: '',
  diagnosis:       '',
  treatment:       '',
  status:          'scheduled' as VisitStatus,
  notes:           '',
}

export default function PatientVisitsPage() {
  const { id } = useParams() as { id: string }
  const [visits, setVisits]           = useState<PatientVisit[]>([])
  const [patientName, setPatientName] = useState('')
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [form, setForm]               = useState(DEFAULT_FORM)
  const [saving, setSaving]           = useState(false)

  const [userId, setUserId]     = useState<string | null>(null)
  const [branchId, setBranchId] = useState<string | null>(null)

  async function loadProfile() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('internal_profiles')
      .select('branch_id')
      .eq('id', user.id)
      .single()
    setUserId(user.id)
    setBranchId(profile?.branch_id ?? null)
  }

  async function load() {
    const supabase = createClient()
    const [patient, { data: v }] = await Promise.all([
      fetchPatient(id),
      supabase.from('patient_visits').select('*').eq('patient_id', id).order('visit_date', { ascending: false }),
    ])
    setPatientName(patient?.name ?? '')
    setVisits((v ?? []) as PatientVisit[])
    setLoading(false)
  }

  useEffect(() => { loadProfile().then(() => load()) }, [id])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!branchId) {
      alert('Akun Anda belum terhubung ke cabang. Hubungi direktur.')
      return
    }
    setSaving(true)
    await createClient().from('patient_visits').insert({
      patient_id:         id,
      branch_id:          branchId,
      attending_staff_id: userId,
      visit_date:         form.visit_date,
      service_type:       form.service_type  || null,
      shift:              form.shift         || null,
      kehadiran:          form.kehadiran     || null,
      regio:              form.regio         || null,
      sumber_pasien:      form.sumber_pasien || null,
      chief_complaint:    form.chief_complaint || null,
      diagnosis:          form.diagnosis     || null,
      treatment:          form.treatment     || null,
      status:             form.status,
      notes:              form.notes         || null,
    })
    setSaving(false)
    setShowForm(false)
    setForm(DEFAULT_FORM)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/patients/${id}`} className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground">
            <ChevronLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Kunjungan</h1>
            <p className="text-sm text-muted-foreground">{patientName}</p>
          </div>
        </div>
        <button onClick={() => { setForm(DEFAULT_FORM); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus size={16} /> Tambah Kunjungan
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <div className="space-y-3">
          {visits.map((v) => (
            <div key={v.id} className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{v.visit_date}</p>
                  {v.shift && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                      {v.shift}
                    </span>
                  )}
                  {v.service_type && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SERVICE_BADGE[v.service_type]}`}>
                      {v.service_type}
                    </span>
                  )}
                  {v.kehadiran && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.kehadiran === 'HADIR' ? 'bg-chart-4/15 text-chart-4' : 'bg-destructive/10 text-destructive'}`}>
                      {v.kehadiran}
                    </span>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[v.status]}`}>
                  {STATUS_LABEL[v.status]}
                </span>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                {[
                  ['Regio', v.regio],
                  ['Keluhan', v.chief_complaint],
                  ['Diagnosis', v.diagnosis],
                  ['Tindakan', v.treatment],
                  ['Sumber Pasien', v.sumber_pasien],
                ].map(([label, value]) => value ? (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-foreground">{value}</dd>
                  </div>
                ) : null)}
              </dl>
              {v.notes && <p className="text-xs text-muted-foreground mt-2 italic">{v.notes}</p>}
            </div>
          ))}
          {!visits.length && <p className="text-sm text-muted-foreground text-center py-8">Belum ada kunjungan.</p>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-foreground mb-4">Tambah Kunjungan</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Tanggal</label>
                  <input required type="date" value={form.visit_date} onChange={(e) => setForm((f) => ({ ...f, visit_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Shift</label>
                  <select value={form.shift} onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value as typeof form.shift }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">— Pilih —</option>
                    <option value="PAGI">PAGI</option>
                    <option value="SORE">SORE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Layanan</label>
                  <select value={form.service_type} onChange={(e) => setForm((f) => ({ ...f, service_type: e.target.value as ServiceType | '' }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">— Pilih —</option>
                    {SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Kehadiran</label>
                  <select value={form.kehadiran} onChange={(e) => setForm((f) => ({ ...f, kehadiran: e.target.value as typeof form.kehadiran }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">— Pilih —</option>
                    <option value="HADIR">HADIR</option>
                    <option value="TIDAK HADIR">TIDAK HADIR</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Regio</label>
                  <select value={form.regio} onChange={(e) => setForm((f) => ({ ...f, regio: e.target.value as BodyRegion | '' }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">— Pilih —</option>
                    {BODY_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as VisitStatus }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary">
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Sumber Pasien</label>
                <input value={form.sumber_pasien} onChange={(e) => setForm((f) => ({ ...f, sumber_pasien: e.target.value }))}
                  placeholder="mis. Rekomendasi orang lain, sosial media"
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>

              {[
                { key: 'chief_complaint', label: 'Keluhan Utama' },
                { key: 'diagnosis', label: 'Diagnosis' },
                { key: 'treatment', label: 'Tindakan' },
                { key: 'notes', label: 'Catatan' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-foreground mb-1">{label}</label>
                  <textarea value={form[key as keyof typeof form]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} rows={2}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                </div>
              ))}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Batal</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
