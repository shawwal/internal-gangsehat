'use client'

import { useEffect, useState } from 'react'
import { X, ChevronLeft, Package, Stethoscope, CalendarPlus } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { PatientPlain } from '@/app/actions/patients'
import { fetchPatientPackages } from '@/app/actions/packages'
import { fetchLayananDetail } from '@/app/actions/transactions'
import { fetchBranchStaff, type BranchStaffMember } from '@/app/actions/jadwal'
import { createHomeVisitSession } from '@/app/actions/homeVisit'
import { PatientPickerStep } from '@/components/jadwal/buy-package/PatientPickerStep'
import { PackageForm } from '@/components/jadwal/buy-package/PackageForm'
import type { PatientPackage } from '@/types'
import type { ServiceType, VisitStatus } from '@/types'
import { INPUT_CLS, LABEL_CLS } from './types'

const STATUS_OPTIONS: { value: VisitStatus; label: string }[] = [
  { value: 'scheduled',   label: 'Terjadwal' },
  { value: 'completed',   label: 'Selesai' },
  { value: 'cancelled',   label: 'Batal' },
  { value: 'rescheduled', label: 'Reschedule' },
]

type Step = 'patient' | 'service' | 'book' | 'buy-package'

export interface NewSessionResult {
  id: string
  patient_id: string
  patient_name: string
  visit_date: string
  service_type: ServiceType
  branch_id: string
  attending_staff_name: string | null
  needsPayment: boolean
}

interface Props {
  branchId: string | null
  onClose: () => void
  onSuccess: (result: NewSessionResult) => void
}

function fmtRp(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`
}

export function NewSessionDialog({ branchId, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('patient')
  const [patient, setPatient] = useState<PatientPlain | null>(null)

  const [taPrice, setTaPrice] = useState<number | null>(null)
  const [sesiPrice, setSesiPrice] = useState<number | null>(null)
  const [p1Price, setP1Price] = useState<number | null>(null)
  const [p2Price, setP2Price] = useState<number | null>(null)
  const [activePackage, setActivePackage] = useState<PatientPackage | null>(null)
  const [servicesLoading, setServicesLoading] = useState(false)

  const [chosenService, setChosenService] = useState<ServiceType | null>(null)
  const [chosenPackageId, setChosenPackageId] = useState<string | null>(null)

  const [branchStaff, setBranchStaff] = useState<BranchStaffMember[]>([])
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0])
  const [staffId, setStaffId] = useState('')
  const [status, setStatus] = useState<VisitStatus>('completed')
  const [complaint, setComplaint] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (branchId) fetchBranchStaff(branchId).then(setBranchStaff)
  }, [branchId])

  useEffect(() => {
    if (!patient || step !== 'service') return
    async function load() {
      if (!patient) return
      setServicesLoading(true)
      const [ta, sesi, p1, p2, packages] = await Promise.all([
        fetchLayananDetail('TA VISIT', branchId),
        fetchLayananDetail('SESI VISIT', branchId),
        fetchLayananDetail('PAKET VISIT', branchId, 5),
        fetchLayananDetail('PAKET VISIT', branchId, 10),
        fetchPatientPackages(patient.id),
      ])
      setTaPrice(ta?.harga ?? null)
      setSesiPrice(sesi?.harga ?? null)
      setP1Price(p1?.harga ?? null)
      setP2Price(p2?.harga ?? null)
      const active = packages.find((p) => p.category === 'PAKET VISIT' && p.status === 'active' && p.remaining_sessions > 0) ?? null
      setActivePackage(active)
      setServicesLoading(false)
    }
    load()
  }, [patient, step, branchId])

  function selectService(service: ServiceType, packageId: string | null) {
    setChosenService(service)
    setChosenPackageId(packageId)
    setStep('book')
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault()
    if (!patient || !chosenService || !branchId) return
    setSaving(true)
    setError(null)

    const { id, error: err } = await createHomeVisitSession({
      patient_id:          patient.id,
      branch_id:           branchId,
      attending_staff_id:  staffId || null,
      visit_date:          visitDate,
      service_type:        chosenService,
      shift:               null,
      kehadiran:           null,
      regio:               null,
      sumber_pasien:       null,
      chief_complaint:     complaint || null,
      diagnosis:           null,
      treatment:           null,
      status,
      notes:               notes || null,
      package_id:          chosenPackageId,
    })

    setSaving(false)
    if (err || !id) { setError(err ?? 'Gagal menyimpan sesi.'); return }

    const staffName = branchStaff.find((s) => s.id === staffId)?.full_name ?? null
    onSuccess({
      id,
      patient_id:   patient.id,
      patient_name: patient.name,
      visit_date:   visitDate,
      service_type: chosenService,
      branch_id:    branchId,
      attending_staff_name: staffName,
      needsPayment: chosenPackageId === null,
    })
  }

  function handlePackagePurchased() {
    // Package created — jump straight into logging the first session against it.
    // We don't have the new package id directly, so re-fetch and pick the freshest active one.
    if (!patient) return
    fetchPatientPackages(patient.id).then((packages) => {
      const fresh = packages.find((p) => p.category === 'PAKET VISIT' && p.status === 'active') ?? null
      setActivePackage(fresh)
      if (fresh) selectService('SESI VISIT', fresh.id)
      else setStep('service')
    })
  }

  const title = {
    patient:       'Sesi Baru: Pilih Pasien',
    service:       `Layanan Tersedia untuk ${patient?.name ?? ''}`,
    book:          'Detail Kunjungan',
    'buy-package': 'Beli Paket Home Visit',
  }[step]

  function back() {
    if (step === 'service') setStep('patient')
    else if (step === 'book' || step === 'buy-package') setStep('service')
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {step !== 'patient' && (
              <button onClick={back} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0">
                <ChevronLeft size={16} />
              </button>
            )}
            <p className="text-sm font-semibold text-foreground truncate">{title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 'patient' && (
            <PatientPickerStep
              patient={patient}
              onSelect={(p) => { setPatient(p); if (p) setStep('service') }}
            />
          )}

          {step === 'service' && patient && (
            servicesLoading ? (
              <div className="grid sm:grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />)}
              </div>
            ) : (
              <div className="grid sm:grid-cols-3 gap-3">
                {/* Terapi Awal */}
                <div className="border border-border rounded-2xl p-4 flex flex-col gap-2">
                  <p className="text-sm font-semibold text-foreground">Terapi Awal</p>
                  <span className="w-fit text-xs px-2 py-0.5 rounded-md bg-muted text-foreground font-medium">1 Sesi</span>
                  <p className="text-lg font-bold text-primary">{taPrice != null ? fmtRp(taPrice) : '—'}</p>
                  <p className="text-xs text-muted-foreground flex-1">Asesmen awal dan sesi pertama.</p>
                  <button
                    onClick={() => selectService('TA VISIT', null)}
                    className="py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Pesan Sesi
                  </button>
                </div>

                {/* Sesi Terapi */}
                <div className="border border-border rounded-2xl p-4 flex flex-col gap-2">
                  <p className="text-sm font-semibold text-foreground">Sesi Terapi</p>
                  <span className="w-fit text-xs px-2 py-0.5 rounded-md bg-muted text-foreground font-medium">1 Sesi</span>
                  <p className="text-lg font-bold text-primary">{sesiPrice != null ? fmtRp(sesiPrice) : '—'}</p>
                  <p className="text-xs text-muted-foreground flex-1">Sesi lanjutan, dibayar per kunjungan.</p>
                  <button
                    onClick={() => selectService('SESI VISIT', null)}
                    className="py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Pesan Sesi
                  </button>
                </div>

                {/* Paket Terapi */}
                <div className="border-2 border-primary rounded-2xl p-4 flex flex-col gap-2">
                  <p className="text-sm font-semibold text-foreground">Paket Terapi</p>
                  {activePackage ? (
                    <>
                      <span className="w-fit text-xs px-2 py-0.5 rounded-md bg-[#34C759]/15 text-[#34C759] font-medium">
                        {activePackage.total_sessions} Sesi
                      </span>
                      <p className="text-sm font-semibold text-[#34C759]">
                        Aktif: {activePackage.remaining_sessions} sesi tersisa
                      </p>
                      <p className="text-xs text-muted-foreground flex-1">
                        {activePackage.package_name} · {activePackage.used_sessions}/{activePackage.total_sessions} terpakai
                      </p>
                      <button
                        onClick={() => selectService('SESI VISIT', activePackage.id)}
                        className="py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Package size={14} /> Potong dari Paket
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="w-fit text-xs px-2 py-0.5 rounded-md bg-muted text-foreground font-medium">5 / 10 Sesi</span>
                      <p className="text-sm text-foreground">
                        P1: {p1Price != null ? fmtRp(p1Price) : '—'} · P2: {p2Price != null ? fmtRp(p2Price) : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground flex-1">Belum ada paket aktif untuk pasien ini.</p>
                      <button
                        onClick={() => setStep('buy-package')}
                        className="py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                      >
                        Beli Paket Baru
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          )}

          {step === 'buy-package' && patient && (
            <PackageForm
              patientId={patient.id}
              patientName={patient.name}
              branchId={branchId}
              lockedCategory="PAKET VISIT"
              onCancel={() => setStep('service')}
              onSuccess={handlePackagePurchased}
            />
          )}

          {step === 'book' && patient && chosenService && (
            <form id="book-session-form" onSubmit={handleBook} className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/15">
                <Stethoscope size={14} className="text-primary shrink-0" />
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{chosenService}</span> untuk <span className="font-semibold">{patient.name}</span>
                  {chosenPackageId && <span className="text-xs text-muted-foreground"> · dipotong dari paket aktif</span>}
                </p>
              </div>

              {branchStaff.length > 0 && (
                <div>
                  <label className={LABEL_CLS}>Fisioterapis</label>
                  <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={INPUT_CLS}>
                    <option value="">Saya sendiri</option>
                    {branchStaff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Tanggal</label>
                  <input required type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Status Layanan</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as VisitStatus)} className={INPUT_CLS}>
                    {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Keluhan Utama</label>
                <textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} rows={2} className={`${INPUT_CLS} resize-none`} />
              </div>

              <div>
                <label className={LABEL_CLS}>Catatan</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${INPUT_CLS} resize-none`} />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}
            </form>
          )}
        </div>

        {step === 'book' && (
          <div className="flex gap-2 px-5 py-4 border-t border-border shrink-0">
            <button type="button" onClick={back} className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
              Kembali
            </button>
            <button
              type="submit"
              form="book-session-form"
              disabled={saving}
              className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5"
            >
              <CalendarPlus size={14} /> {saving ? 'Menyimpan...' : 'Simpan Sesi'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
