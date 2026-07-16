'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ChevronLeft, Plus, Activity, CheckCircle2, Clock, UserX, FileText, User, CreditCard,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchPatient } from '@/app/actions/patients'
import { MedicalRecordModal } from '@/components/jadwal/MedicalRecordModal'
import { PaymentDialog } from '@/components/visits/PaymentDialog'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportToExcel } from '@/lib/excel-export'
import { PostAssessmentPackageDialog } from '@/components/visits/PostAssessmentPackageDialog'
import { getVisitFormRoute } from '@/lib/visitRouting'
import type { PaymentVisitInfo } from '@/components/visits/PaymentDialog'
import type { MedicalRecordSavedContext } from '@/components/jadwal/MedicalRecordModal'
import type { PatientVisit, VisitStatus, ServiceType, BodyRegion, UserRole } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_OPTIONS: VisitStatus[] = ['scheduled', 'completed', 'cancelled', 'no_show']

const STATUS_LABEL: Record<VisitStatus, string> = {
  scheduled: 'Terjadwal',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  no_show:   'Tidak Hadir',
}

const STATUS_BADGE: Record<VisitStatus, string> = {
  scheduled: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  completed: 'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/20',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/20',
  no_show:   'bg-muted/40 text-muted-foreground border-border',
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
  'TERAPI AWAL':  'bg-primary/15 text-primary border-primary/20',
  'PAKET TERAPI': 'bg-chart-4/15 text-chart-4 border-chart-4/20',
  'SESI TERAPI':  'bg-secondary/20 text-secondary-foreground border-secondary/20',
  'TA VISIT':     'bg-primary/10 text-primary border-primary/15',
  'SESI VISIT':   'bg-muted/40 text-muted-foreground border-border',
  'PAKET VISIT':  'bg-chart-4/10 text-chart-4 border-chart-4/15',
  'LAINNYA':      'bg-muted/40 text-muted-foreground border-border',
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

interface LinkedTx { id: string; payment_status: string | null; outstanding: number; status: string }

function getPaymentBadge(visit: PatientVisit): { label: string; cls: string; unpaid: boolean } | null {
  if (visit.status !== 'completed') return null
  // Package sessions are pre-paid via the package transaction — no per-visit payment needed
  if ((visit as unknown as { package_id: string | null }).package_id) return null
  const txs = ((visit as unknown as { transactions: LinkedTx[] | null }).transactions ?? [])
    .filter((t) => t.status !== 'rejected')
  if (txs.length === 0) return { label: 'Belum Bayar', cls: 'bg-[#FFB35C]/15 text-[#FFB35C] border-[#FFB35C]/25', unpaid: true }
  const allPaid = txs.every((t) => t.outstanding === 0)
  if (allPaid) return { label: 'Lunas', cls: 'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/25', unpaid: false }
  return { label: 'DP / Ada Sisa', cls: 'bg-[#FFB35C]/15 text-[#FFB35C] border-[#FFB35C]/25', unpaid: false }
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, loading }: {
  label: string; value: number; icon: React.ElementType; color: string; loading?: boolean
}) {
  return (
    <div className="glass-card p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        {loading
          ? <div className="h-6 w-10 bg-muted animate-pulse rounded mt-0.5" />
          : <p className="text-xl font-bold text-foreground leading-tight">{value.toLocaleString('id-ID')}</p>
        }
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PatientVisitsPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()

  const [visits, setVisits]           = useState<PatientVisit[]>([])
  const [patientName, setPatientName] = useState('')
  const [noRm, setNoRm]               = useState('')
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [form, setForm]               = useState(DEFAULT_FORM)
  const [saving, setSaving]           = useState(false)

  const [userId, setUserId]     = useState<string | null>(null)
  const [branchId, setBranchId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)

  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null)
  const [paymentVisit, setPaymentVisit]       = useState<PaymentVisitInfo | null>(null)
  const [packagePrompt, setPackagePrompt]     = useState<MedicalRecordSavedContext | null>(null)

  const canRecordPayment = !!userRole && ['finance', 'manager', 'director'].includes(userRole)

  function openVisit(v: PatientVisit) {
    const route = getVisitFormRoute(v.service_type)
    if (route) {
      router.push(`/visits/${v.id}/${route}?from=/patients/${id}/visits`)
      return
    }
    setSelectedVisitId(v.id)
  }

  async function loadProfile() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('internal_profiles')
      .select('branch_id, role')
      .eq('id', user.id)
      .single()
    setUserId(user.id)
    setBranchId(profile?.branch_id ?? null)
    setUserRole((profile?.role as UserRole) ?? null)
  }

  async function load() {
    const supabase = createClient()
    const [patient, { data: v }] = await Promise.all([
      fetchPatient(id),
      supabase
        .from('patient_visits')
        .select('*, internal_profiles!attending_staff_id(id, full_name, nickname), transactions!visit_id(id, payment_status, outstanding, status)')
        .eq('patient_id', id)
        .order('visit_date', { ascending: false }),
    ])
    setPatientName(patient?.name ?? '')
    setNoRm(patient?.no_rm ?? '')
    setVisits((v ?? []) as unknown as PatientVisit[])
    setLoading(false)
  }

  useEffect(() => { loadProfile().then(() => load()) }, [id])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!branchId) { alert('Akun Anda belum terhubung ke cabang.'); return }
    setSaving(true)
    await createClient().from('patient_visits').insert({
      patient_id:         id,
      branch_id:          branchId,
      attending_staff_id: userId,
      visit_date:         form.visit_date,
      service_type:       form.service_type    || null,
      shift:              form.shift           || null,
      kehadiran:          form.kehadiran       || null,
      regio:              form.regio           || null,
      sumber_pasien:      form.sumber_pasien   || null,
      chief_complaint:    form.chief_complaint || null,
      diagnosis:          form.diagnosis       || null,
      treatment:          form.treatment       || null,
      status:             form.status,
      notes:              form.notes           || null,
    })
    setSaving(false)
    setShowForm(false)
    setForm(DEFAULT_FORM)
    load()
  }

  function handleExportVisits() {
    const therapistName = (v: PatientVisit) => {
      const raw = (v as unknown as { internal_profiles: { full_name: string; nickname: string | null } | null }).internal_profiles
      if (!raw) return ''
      return raw.nickname ? `${raw.nickname} · ${raw.full_name}` : raw.full_name
    }
    exportToExcel(visits, [
      { header: 'Tanggal',      value: (v) => v.visit_date },
      { header: 'Shift',        value: (v) => v.shift ?? '' },
      { header: 'Layanan',      value: (v) => v.service_type ?? '' },
      { header: 'Terapis',      value: therapistName },
      { header: 'Regio',        value: (v) => v.regio ?? '' },
      { header: 'Sumber',       value: (v) => v.sumber_pasien ?? '' },
      { header: 'Keluhan',      value: (v) => v.chief_complaint ?? '' },
      { header: 'Diagnosis',    value: (v) => v.diagnosis ?? '' },
      { header: 'Tindakan',     value: (v) => v.treatment ?? '' },
      { header: 'Kehadiran',    value: (v) => v.kehadiran ?? '' },
      { header: 'Status',       value: (v) => STATUS_LABEL[v.status] },
      { header: 'Catatan',      value: (v) => v.notes ?? '' },
    ], `rekam_medis_${patientName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`)
    return Promise.resolve()
  }

  // Derived stats
  const total     = visits.length
  const completed = visits.filter((v) => v.status === 'completed').length
  const scheduled = visits.filter((v) => v.status === 'scheduled').length
  const noShow    = visits.filter((v) => v.status === 'no_show' || v.kehadiran === 'TIDAK HADIR').length

  const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
  const labelCls = 'block text-xs font-medium text-foreground mb-1'

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href={`/patients/${id}`}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
          >
            <ChevronLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Rekam Medis</h1>
            <p className="text-sm text-muted-foreground">
              {patientName || '—'}
              {noRm && <span className="ml-2 font-mono text-xs text-muted-foreground/70">{noRm}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!loading && visits.length > 0 && (
            <ExportButton onExport={handleExportVisits} label="Export" />
          )}
          <button
            onClick={() => { setForm(DEFAULT_FORM); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} /> Tambah Kunjungan
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Kunjungan" value={total}     icon={Activity}     color="bg-primary/10 text-primary"          loading={loading} />
        <StatCard label="Selesai"         value={completed} icon={CheckCircle2} color="bg-[#34C759]/10 text-[#34C759]"      loading={loading} />
        <StatCard label="Terjadwal"       value={scheduled} icon={Clock}        color="bg-blue-500/10 text-blue-400"         loading={loading} />
        <StatCard label="Tidak Hadir"     value={noShow}    icon={UserX}        color="bg-destructive/10 text-destructive"  loading={loading} />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-10">No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Tanggal</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Layanan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Terapis</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Regio</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Keluhan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kehadiran</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pembayaran</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rekam Medis</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded-lg" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : visits.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <FileText size={22} className="text-primary" />
                      </div>
                      <p className="text-sm font-medium text-foreground">Belum ada kunjungan</p>
                      <p className="text-xs text-muted-foreground">Tekan "Tambah Kunjungan" untuk mencatat kunjungan baru</p>
                    </div>
                  </td>
                </tr>
              ) : (
                visits.map((v, i) => (
                  <tr
                    key={v.id}
                    onClick={() => openVisit(v)}
                    className="border-b border-border/50 hover:bg-primary/5 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-medium text-foreground">{formatDate(v.visit_date)}</p>
                      {v.shift && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                          {v.shift}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {v.service_type ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SERVICE_BADGE[v.service_type]}`}>
                          {v.service_type}
                        </span>
                      ) : <span className="text-muted-foreground/40 text-xs">—</span>}
                    </td>

                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const raw = (v as unknown as { internal_profiles: { id: string; full_name: string; nickname: string | null } | { id: string; full_name: string; nickname: string | null }[] | null }).internal_profiles
                        const t = raw ? (Array.isArray(raw) ? raw[0] : raw) : null
                        if (!t) return <span className="text-muted-foreground/40 text-xs">—</span>
                        return (
                          <Link href="/director/users" className="flex items-center gap-1.5 group w-fit">
                            <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <User size={10} className="text-primary" />
                            </span>
                            <span className="text-xs text-foreground group-hover:text-primary transition-colors">
                              {t.nickname
                                ? <><span className="font-medium">{t.nickname}</span> · {t.full_name}</>
                                : t.full_name
                              }
                            </span>
                          </Link>
                        )
                      })()}
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-xs text-foreground/80">{v.regio ?? '—'}</span>
                    </td>

                    <td className="px-4 py-3 max-w-45">
                      <p className="text-xs text-foreground/80 truncate">{v.chief_complaint ?? '—'}</p>
                      {v.diagnosis && (
                        <p className="text-[10px] text-muted-foreground truncate">{v.diagnosis}</p>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {v.kehadiran ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                          v.kehadiran === 'HADIR'
                            ? 'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/20'
                            : 'bg-destructive/15 text-destructive border-destructive/20'
                        }`}>
                          {v.kehadiran}
                        </span>
                      ) : <span className="text-muted-foreground/40 text-xs">—</span>}
                    </td>

                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE[v.status]}`}>
                        {STATUS_LABEL[v.status]}
                      </span>
                    </td>

                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const badge = getPaymentBadge(v)
                        if (!badge) return <span className="text-muted-foreground/40 text-xs">—</span>
                        const therapist = (() => {
                          const raw = (v as unknown as { internal_profiles: { id: string; full_name: string; nickname: string | null } | null }).internal_profiles
                          return raw ? (raw.nickname || raw.full_name) : undefined
                        })()
                        return (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${badge.cls}`}>
                              {badge.label}
                            </span>
                            {canRecordPayment && (
                              <button
                                onClick={() => setPaymentVisit({
                                  id:                   v.id,
                                  patient_id:           v.patient_id,
                                  patient_name:         patientName,
                                  visit_date:           v.visit_date,
                                  service_type:         v.service_type,
                                  attending_staff_name: therapist,
                                })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-[#34C759] hover:bg-[#34C759]/10 transition-colors border border-[#34C759]/20"
                              >
                                <CreditCard size={11} />
                                {badge.unpaid ? 'Catat' : 'Tambah'}
                              </button>
                            )}
                          </div>
                        )
                      })()}
                    </td>

                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openVisit(v)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                      >
                        <FileText size={12} />
                        Buka
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && total > 0 && (
          <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
            {total.toLocaleString('id-ID')} kunjungan total
          </div>
        )}
      </div>

      {/* Add visit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div
            className="bg-card rounded-2xl border border-border w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h2 className="text-sm font-semibold text-foreground">Tambah Kunjungan</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors text-lg leading-none">×</button>
            </div>

            <form id="add-visit-form" onSubmit={handleAdd} className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tanggal</label>
                  <input required type="date" value={form.visit_date}
                    onChange={(e) => setForm((f) => ({ ...f, visit_date: e.target.value }))}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Shift</label>
                  <select value={form.shift} onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value as typeof form.shift }))} className={inputCls}>
                    <option value="">— Pilih —</option>
                    <option value="PAGI">PAGI</option>
                    <option value="SORE">SORE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Layanan</label>
                  <select value={form.service_type} onChange={(e) => setForm((f) => ({ ...f, service_type: e.target.value as ServiceType | '' }))} className={inputCls}>
                    <option value="">— Pilih —</option>
                    {SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Kehadiran</label>
                  <select value={form.kehadiran} onChange={(e) => setForm((f) => ({ ...f, kehadiran: e.target.value as typeof form.kehadiran }))} className={inputCls}>
                    <option value="">— Pilih —</option>
                    <option value="HADIR">HADIR</option>
                    <option value="TIDAK HADIR">TIDAK HADIR</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Regio</label>
                  <select value={form.regio} onChange={(e) => setForm((f) => ({ ...f, regio: e.target.value as BodyRegion | '' }))} className={inputCls}>
                    <option value="">— Pilih —</option>
                    {BODY_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as VisitStatus }))} className={inputCls}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Sumber Pasien</label>
                <input value={form.sumber_pasien} onChange={(e) => setForm((f) => ({ ...f, sumber_pasien: e.target.value }))}
                  placeholder="mis. Rekomendasi, sosial media"
                  className={inputCls} />
              </div>

              {([
                ['chief_complaint', 'Keluhan Utama'],
                ['diagnosis', 'Diagnosis'],
                ['treatment', 'Tindakan'],
                ['notes', 'Catatan'],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className={labelCls}>{label}</label>
                  <textarea
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    rows={2}
                    className={`${inputCls} resize-none`}
                  />
                </div>
              ))}
            </form>

            <div className="flex gap-2 px-5 py-4 border-t border-border shrink-0">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                Batal
              </button>
              <button type="submit" form="add-visit-form" disabled={saving}
                className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Medical record modal */}
      <MedicalRecordModal
        visitId={selectedVisitId}
        onClose={() => setSelectedVisitId(null)}
        onSaved={(ctx) => {
          const visitId = selectedVisitId
          setSelectedVisitId(null)
          const route = getVisitFormRoute(ctx?.service_type)
          if (route) {
            if (visitId) router.push(`/visits/${visitId}/${route}?from=/patients/${id}/visits`)
            return
          }
          load()
          if (
            ctx &&
            ctx.status === 'completed' &&
            ctx.service_type === 'TA VISIT'
          ) {
            setPackagePrompt(ctx)
          }
        }}
      />

      {/* Payment dialog */}
      {paymentVisit && (
        <PaymentDialog
          visit={paymentVisit}
          onClose={() => setPaymentVisit(null)}
          onSuccess={() => { setPaymentVisit(null); load() }}
        />
      )}

      {/* Post-assessment package recommendation */}
      {packagePrompt && (
        <PostAssessmentPackageDialog
          patientId={packagePrompt.patient_id}
          patientName={patientName}
          branchId={branchId}
          sourceServiceType={packagePrompt.service_type}
          onClose={() => setPackagePrompt(null)}
          onSuccess={() => { setPackagePrompt(null); load() }}
        />
      )}
    </div>
  )
}
