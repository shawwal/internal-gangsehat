'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, ExternalLink, FileText, Loader2 } from 'lucide-react'
import { fetchVisitWithPatient, updateVisit } from '@/app/actions/jadwal'
import type { VisitWithPatient } from '@/app/actions/jadwal'
import type { VisitStatus, ServiceType, BodyRegion } from '@/types'
import { getVisitFormRoute } from '@/lib/visitRouting'
import { STATUS_LABEL } from './types'

const STATUS_OPTIONS: VisitStatus[] = ['scheduled', 'completed', 'cancelled', 'no_show']

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

export interface MedicalRecordSavedContext {
  service_type: string
  status: VisitStatus
  patient_id: string
}

interface Props {
  visitId: string | null
  contextShift?: string | null
  contextServiceType?: string | null
  contextKehadiran?: string | null
  onClose: () => void
  onSaved: (ctx?: MedicalRecordSavedContext) => void
}

type FormState = {
  service_type: string
  shift: string
  kehadiran: string
  regio: string
  sumber_pasien: string
  chief_complaint: string
  diagnosis: string
  treatment: string
  status: VisitStatus
  notes: string
}

function toForm(v: VisitWithPatient, contextShift?: string | null, contextServiceType?: string | null, contextKehadiran?: string | null): FormState {
  return {
    service_type:    v.service_type    ?? contextServiceType ?? '',
    shift:           v.shift           ?? contextShift       ?? '',
    kehadiran:       v.kehadiran       ?? contextKehadiran   ?? '',
    regio:           v.regio           ?? '',
    sumber_pasien:   v.sumber_pasien   ?? '',
    chief_complaint: v.chief_complaint ?? '',
    diagnosis:       v.diagnosis       ?? '',
    treatment:       v.treatment       ?? '',
    status:          v.status,
    notes:           v.notes           ?? '',
  }
}

export function MedicalRecordModal({ visitId, contextShift, contextServiceType, contextKehadiran, onClose, onSaved }: Props) {
  const [visit, setVisit]   = useState<VisitWithPatient | null>(null)
  const [form, setForm]     = useState<FormState | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!visitId) { setVisit(null); setForm(null); return }
    setLoading(true)
    setError(null)
    fetchVisitWithPatient(visitId).then((data) => {
      setVisit(data)
      setForm(data ? toForm(data, contextShift, contextServiceType, contextKehadiran) : null)
      setLoading(false)
    })
  }, [visitId])

  useEffect(() => {
    if (!visitId) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [visitId, onClose])

  if (!visitId) return null

  const formRoute = getVisitFormRoute(form?.service_type)
  const hideClinicalFields = formRoute !== null
  const statusOptions = hideClinicalFields ? STATUS_OPTIONS.filter((s) => s !== 'completed') : STATUS_OPTIONS

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form || !visitId) return
    if (form.status === 'completed') {
      if (!form.diagnosis.trim())  { setError('Diagnosis wajib diisi sebelum menandai kunjungan sebagai Selesai.'); return }
      if (!form.treatment.trim())  { setError('Tindakan wajib diisi sebelum menandai kunjungan sebagai Selesai.'); return }
      if (!form.regio)             { setError('Regio wajib dipilih sebelum menandai kunjungan sebagai Selesai.'); return }
    }
    setSaving(true)
    setError(null)
    const { error: err } = await updateVisit(visitId, {
      service_type:    form.service_type    || null,
      shift:           form.shift           || null,
      kehadiran:       form.kehadiran       || null,
      regio:           form.regio           || null,
      sumber_pasien:   form.sumber_pasien   || null,
      chief_complaint: form.chief_complaint || null,
      diagnosis:       form.diagnosis       || null,
      treatment:       form.treatment       || null,
      status:          form.status,
      notes:           form.notes           || null,
    })
    setSaving(false)
    if (err) { setError(err); return }
    onSaved(visit ? { service_type: form.service_type, status: form.status, patient_id: visit.patient_id } : undefined)
  }

  function set(key: keyof FormState, value: string) {
    setForm((f) => f ? { ...f, [key]: value } : f)
  }

  const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
  const labelCls = 'block text-xs font-medium text-foreground mb-1'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="text-primary shrink-0" />
            <div className="min-w-0">
              {loading ? (
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-sm font-semibold text-foreground truncate">
                  {visit?.patient_name ?? 'Rekam Medis'}
                </p>
              )}
              {visit && (
                <p className="text-xs text-muted-foreground">{visit.visit_date}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {visit && (
              <Link
                href={`/patients/${visit.patient_id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Lihat semua kunjungan pasien"
              >
                <ExternalLink size={12} />
                Semua Rekam Medis
              </Link>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors ml-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && !visit && (
            <p className="text-sm text-muted-foreground text-center py-12">Kunjungan tidak ditemukan.</p>
          )}

          {!loading && visit && form && (
            <form id="medical-record-form" onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Layanan</label>
                  <select value={form.service_type} onChange={(e) => set('service_type', e.target.value)} className={inputCls}>
                    <option value="">— Pilih —</option>
                    {SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Shift</label>
                  <select value={form.shift} onChange={(e) => set('shift', e.target.value)} className={inputCls}>
                    <option value="">— Pilih —</option>
                    <option value="PAGI">PAGI</option>
                    <option value="SORE">SORE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Kehadiran</label>
                  <select value={form.kehadiran} onChange={(e) => set('kehadiran', e.target.value)} className={inputCls}>
                    <option value="">— Pilih —</option>
                    <option value="HADIR">HADIR</option>
                    <option value="TIDAK HADIR">TIDAK HADIR</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={form.status} onChange={(e) => set('status', e.target.value as VisitStatus)} className={inputCls}>
                    {statusOptions.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
              </div>

              {hideClinicalFields ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-primary">
                  {formRoute === 'assessment'
                    ? 'Kunjungan Terapi Awal menggunakan Form Asesmen Lengkap (Regio, Diagnosis, Tindakan, dll). Simpan lalu lanjutkan ke form tersebut.'
                    : 'Kunjungan ini menggunakan Form Catatan Sesi (SOAP). Simpan lalu lanjutkan ke form tersebut.'}
                </div>
              ) : (
                <>
                  <div>
                    <label className={labelCls}>Regio</label>
                    <select value={form.regio} onChange={(e) => set('regio', e.target.value)} className={inputCls}>
                      <option value="">— Pilih —</option>
                      {BODY_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className={labelCls}>Sumber Pasien</label>
                    <input
                      value={form.sumber_pasien}
                      onChange={(e) => set('sumber_pasien', e.target.value)}
                      placeholder="mis. Rekomendasi, sosial media"
                      className={inputCls}
                    />
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
                        onChange={(e) => set(key, e.target.value)}
                        rows={2}
                        className={`${inputCls} resize-none`}
                      />
                    </div>
                  ))}
                </>
              )}

              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        {!loading && visit && form && (
          <div className="flex gap-2 px-5 py-4 border-t border-border shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              form="medical-record-form"
              disabled={saving}
              className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
