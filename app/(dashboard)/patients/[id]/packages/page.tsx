'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ChevronLeft, Plus, Package, CheckCircle2, XCircle, Layers,
  Pencil, Trash2, X, ChevronDown, ChevronUp,
} from 'lucide-react'
import { fetchPatient } from '@/app/actions/patients'
import {
  fetchPatientPackages,
  fetchPackageSessions,
  createPatientPackage,
  updatePatientPackage,
  deletePatientPackage,
} from '@/app/actions/packages'
import { createClient } from '@/lib/supabase/client'
import type {
  PatientPackage, PackageSession, JenisPaket, PackageOperationalStatus,
  PackageCompletionStatus, PackageStatus,
} from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────
const OP_STATUS_BADGE: Record<PackageOperationalStatus, string> = {
  ON:      'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/20',
  OFF:     'bg-muted/40 text-muted-foreground border-border',
  PENDING: 'bg-secondary/20 text-secondary-foreground border-secondary/20',
}

const STATUS_BADGE: Record<PackageStatus, string> = {
  active:    'bg-primary/15 text-primary border-primary/20',
  completed: 'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/20',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/20',
}

const STATUS_LABEL: Record<PackageStatus, string> = {
  active:    'Aktif',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}

const COMPLETION_LABEL: Record<PackageCompletionStatus, string> = {
  LANJUT:         'Lanjut',
  SEMBUH:         'Sembuh',
  'TIDAK LANJUT': 'Tidak Lanjut',
  STOP:           'Stop',
}

const COMPLETION_BADGE: Record<PackageCompletionStatus, string> = {
  LANJUT:         'bg-blue-500/15 text-blue-400 border-blue-500/20',
  SEMBUH:         'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/20',
  'TIDAK LANJUT': 'bg-muted/40 text-muted-foreground border-border',
  STOP:           'bg-destructive/15 text-destructive border-destructive/20',
}

// ── Default form state ────────────────────────────────────────────────────────
const DEFAULT_FORM = {
  package_name:       '',
  jenis_paket:        'P1' as JenisPaket,
  mulai_paket:        'NEW' as 'NEW' | 'EXT.',
  operational_status: 'ON' as PackageOperationalStatus,
  completion_status:  '' as PackageCompletionStatus | '',
  status:             'active' as PackageStatus,
  notes:              '',
}

type FormState = typeof DEFAULT_FORM

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function sessionBarColor(remaining: number, total: number): string {
  if (total === 0) return 'bg-muted'
  if (remaining === 0) return 'bg-destructive'
  if (remaining <= 2) return 'bg-[#FFB35C]'
  return 'bg-[#34C759]'
}

function sessionTextColor(remaining: number): string {
  if (remaining === 0) return 'text-destructive'
  if (remaining <= 2) return 'text-[#FFB35C]'
  return 'text-[#34C759]'
}

// ── Stat card ─────────────────────────────────────────────────────────────────
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
          ? <div className="h-6 w-8 bg-muted animate-pulse rounded mt-0.5" />
          : <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
        }
      </div>
    </div>
  )
}

// ── Package card ──────────────────────────────────────────────────────────────
function PackageCard({
  pkg,
  onEdit,
  onDelete,
}: {
  pkg: PatientPackage
  onEdit: (pkg: PatientPackage) => void
  onDelete: (id: string) => void
}) {
  const pct = pkg.total_sessions > 0 ? (pkg.used_sessions / pkg.total_sessions) * 100 : 0
  const [expanded, setExpanded] = useState(false)
  const [sessions, setSessions] = useState<PackageSession[] | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(false)

  async function toggleSessions() {
    if (!expanded && sessions === null) {
      setLoadingSessions(true)
      const data = await fetchPackageSessions(pkg.id)
      setSessions(data)
      setLoadingSessions(false)
    }
    setExpanded((v) => !v)
  }

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground truncate">{pkg.package_name}</span>
            {pkg.jenis_paket && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                {pkg.jenis_paket}
              </span>
            )}
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${OP_STATUS_BADGE[pkg.operational_status]}`}>
              {pkg.operational_status}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_BADGE[pkg.status]}`}>
              {STATUS_LABEL[pkg.status]}
            </span>
            {pkg.mulai_paket && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border font-medium">
                {pkg.mulai_paket}
              </span>
            )}
            {pkg.completion_status && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${COMPLETION_BADGE[pkg.completion_status]}`}>
                {COMPLETION_LABEL[pkg.completion_status]}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(pkg)}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          {pkg.status === 'active' && (
            <button
              onClick={() => onDelete(pkg.id)}
              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Batalkan"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Session progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{pkg.used_sessions} dari {pkg.total_sessions} sesi digunakan</span>
          <span className={`font-semibold ${sessionTextColor(pkg.remaining_sessions)}`}>
            {pkg.remaining_sessions} sesi tersisa
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${sessionBarColor(pkg.remaining_sessions, pkg.total_sessions)}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      {/* Session drill-down toggle */}
      <button
        onClick={toggleSessions}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors text-xs text-muted-foreground"
      >
        <span>Sesi Terpakai ({pkg.used_sessions})</span>
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {/* Session list */}
      {expanded && (
        <div className="rounded-xl border border-border overflow-hidden">
          {loadingSessions ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3 px-3 py-2.5 animate-pulse">
                  <div className="h-3 bg-muted rounded w-20" />
                  <div className="h-3 bg-muted rounded w-24" />
                  <div className="h-3 bg-muted rounded w-12" />
                </div>
              ))}
            </div>
          ) : !sessions || sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Belum ada sesi yang tercatat untuk paket ini
            </p>
          ) : (
            <div className="divide-y divide-border">
              {sessions.map((s, i) => (
                <div key={s.id} className={`px-3 py-2 text-xs ${i % 2 === 1 ? 'bg-muted/30' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">
                      {new Date(s.visit_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </span>
                    <span className="text-foreground font-medium truncate flex-1 text-center">{s.service_type}</span>
                    <span className="shrink-0 flex items-center gap-1">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.kehadiran === 'HADIR' ? 'bg-[#34C759]' : 'bg-destructive'}`} />
                      <span className="text-muted-foreground">{s.kehadiran ?? '—'}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-muted-foreground/60 text-[10px]">
                      {s.therapist_name ?? 'Terapis tidak tercatat'}
                    </span>
                    {s.shift && (
                      <span className="text-[10px] text-muted-foreground/60">· {s.shift}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        {pkg.notes ? (
          <p className="text-xs text-muted-foreground truncate max-w-[60%]">{pkg.notes}</p>
        ) : (
          <span />
        )}
        <p className="text-[10px] text-muted-foreground/60 shrink-0">
          {formatDate(pkg.created_at)}
        </p>
      </div>
    </div>
  )
}

// ── Add/Edit modal ────────────────────────────────────────────────────────────
function PackageModal({
  editTarget,
  branchId,
  patientId,
  onClose,
  onSaved,
}: {
  editTarget: PatientPackage | null
  branchId: string | null
  patientId: string
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!editTarget
  const [form, setForm] = useState<FormState>(() =>
    editTarget
      ? {
          package_name:       editTarget.package_name,
          jenis_paket:        editTarget.jenis_paket ?? 'P1',
          mulai_paket:        editTarget.mulai_paket ?? 'NEW',
          operational_status: editTarget.operational_status,
          completion_status:  editTarget.completion_status ?? '',
          status:             editTarget.status,
          notes:              editTarget.notes ?? '',
        }
      : DEFAULT_FORM,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sessionCount = form.jenis_paket === 'P1' ? 5 : 10

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.package_name.trim()) { setError('Nama paket wajib diisi.'); return }
    setSaving(true)
    setError(null)

    if (isEdit && editTarget) {
      const { error: err } = await updatePatientPackage(editTarget.id, {
        package_name:       form.package_name.trim(),
        jenis_paket:        form.jenis_paket,
        mulai_paket:        form.mulai_paket,
        operational_status: form.operational_status,
        completion_status:  form.completion_status || null,
        status:             form.status,
        notes:              form.notes.trim() || null,
      })
      if (err) { setError(err); setSaving(false); return }
    } else {
      const { error: err } = await createPatientPackage({
        patient_id:   patientId,
        branch_id:    branchId,
        package_name: form.package_name.trim(),
        jenis_paket:  form.jenis_paket,
        mulai_paket:  form.mulai_paket,
        notes:        form.notes.trim() || null,
      })
      if (err) { setError(err); setSaving(false); return }
    }

    setSaving(false)
    onSaved()
  }

  const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
  const labelCls = 'block text-xs font-medium text-foreground mb-1.5'

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-foreground">
            {isEdit ? 'Edit Paket' : 'Tambah Paket Terapi'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form id="pkg-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Name */}
          <div>
            <label className={labelCls}>Nama Paket</label>
            <input
              required
              type="text"
              placeholder="mis. Paket Fisio Lutut"
              value={form.package_name}
              onChange={(e) => set('package_name', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Jenis Paket */}
          <div>
            <label className={labelCls}>Jenis Paket</label>
            <div className="grid grid-cols-2 gap-2">
              {(['P1', 'P2'] as JenisPaket[]).map((jp) => (
                <button
                  key={jp}
                  type="button"
                  onClick={() => set('jenis_paket', jp)}
                  className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    form.jenis_paket === jp
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {jp} <span className="font-normal">({jp === 'P1' ? 5 : 10} sesi)</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {sessionCount} sesi akan ditetapkan otomatis
            </p>
          </div>

          {/* Mulai Paket */}
          <div>
            <label className={labelCls}>Mulai Paket</label>
            <div className="grid grid-cols-2 gap-2">
              {(['NEW', 'EXT.'] as const).map((mp) => (
                <button
                  key={mp}
                  type="button"
                  onClick={() => set('mulai_paket', mp)}
                  className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    form.mulai_paket === mp
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {mp === 'NEW' ? 'NEW (Baru)' : 'EXT. (Lanjutan)'}
                </button>
              ))}
            </div>
          </div>

          {/* Operational Status */}
          <div>
            <label className={labelCls}>Status Operasional</label>
            <div className="grid grid-cols-3 gap-2">
              {(['ON', 'OFF', 'PENDING'] as PackageOperationalStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('operational_status', s)}
                  className={`py-2 rounded-xl border text-xs font-medium transition-colors ${
                    form.operational_status === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Edit-only fields */}
          {isEdit && (
            <>
              <div>
                <label className={labelCls}>Status Paket</label>
                <select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value as PackageStatus)}
                  className={inputCls}
                >
                  <option value="active">Aktif</option>
                  <option value="completed">Selesai</option>
                  <option value="cancelled">Dibatalkan</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Status Penyelesaian</label>
                <select
                  value={form.completion_status}
                  onChange={(e) => set('completion_status', e.target.value as PackageCompletionStatus | '')}
                  className={inputCls}
                >
                  <option value="">— Pilih —</option>
                  <option value="LANJUT">Lanjut</option>
                  <option value="SEMBUH">Sembuh</option>
                  <option value="TIDAK LANJUT">Tidak Lanjut</option>
                  <option value="STOP">Stop</option>
                </select>
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label className={labelCls}>Catatan</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              placeholder="Catatan tambahan (opsional)"
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            form="pkg-form"
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Menyimpan...' : isEdit ? 'Simpan' : 'Tambah'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirm ────────────────────────────────────────────────────────────
function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-sm shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-destructive/10 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Batalkan Paket?</p>
            <p className="text-xs text-muted-foreground mt-0.5">Paket akan ditandai sebagai dibatalkan. Riwayat sesi tetap tersimpan.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Kembali
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 transition-colors"
          >
            Ya, Batalkan
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PatientPackagesPage() {
  const { id } = useParams() as { id: string }

  const [packages, setPackages] = useState<PatientPackage[]>([])
  const [patientName, setPatientName] = useState('')
  const [noRm, setNoRm] = useState('')
  const [loading, setLoading] = useState(true)
  const [branchId, setBranchId] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<PatientPackage | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  async function loadProfile() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('internal_profiles')
      .select('branch_id')
      .eq('id', user.id)
      .single()
    setBranchId(profile?.branch_id ?? null)
  }

  async function load() {
    const [patient, pkgs] = await Promise.all([
      fetchPatient(id),
      fetchPatientPackages(id),
    ])
    setPatientName(patient?.name ?? '')
    setNoRm(patient?.no_rm ?? '')
    setPackages(pkgs)
    setLoading(false)
  }

  useEffect(() => { loadProfile().then(() => load()) }, [id])

  function openAdd() {
    setEditTarget(null)
    setShowModal(true)
  }

  function openEdit(pkg: PatientPackage) {
    setEditTarget(pkg)
    setShowModal(true)
  }

  async function handleDelete(pkgId: string) {
    await deletePatientPackage(pkgId)
    setDeleteTarget(null)
    load()
  }

  // Derived stats
  const total     = packages.length
  const active    = packages.filter((p) => p.status === 'active').length
  const completed = packages.filter((p) => p.status === 'completed').length
  const cancelled = packages.filter((p) => p.status === 'cancelled').length

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href={`/patients/${id}`}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
          >
            <ChevronLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Paket Terapi</h1>
            <p className="text-sm text-muted-foreground">
              {patientName || '—'}
              {noRm && <span className="ml-2 font-mono text-xs text-muted-foreground/70">{noRm}</span>}
            </p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} /> Tambah Paket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Paket"  value={total}     icon={Layers}       color="bg-primary/10 text-primary"          loading={loading} />
        <StatCard label="Aktif"        value={active}    icon={Package}      color="bg-[#34C759]/10 text-[#34C759]"      loading={loading} />
        <StatCard label="Selesai"      value={completed} icon={CheckCircle2} color="bg-blue-500/10 text-blue-400"        loading={loading} />
        <StatCard label="Dibatalkan"   value={cancelled} icon={XCircle}      color="bg-destructive/10 text-destructive"  loading={loading} />
      </div>

      {/* List */}
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-5 space-y-3 animate-pulse">
              <div className="h-4 bg-muted rounded-lg w-1/2" />
              <div className="h-2 bg-muted rounded-full" />
              <div className="h-3 bg-muted rounded-lg w-1/3" />
            </div>
          ))}
        </div>
      ) : packages.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Package size={26} className="text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">Belum ada paket terapi</p>
          <p className="text-xs text-muted-foreground">Tekan "Tambah Paket" untuk menambahkan paket baru</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {packages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              onEdit={openEdit}
              onDelete={(pkgId) => setDeleteTarget(pkgId)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <PackageModal
          editTarget={editTarget}
          branchId={branchId}
          patientId={id}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
