'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2, AlertTriangle } from 'lucide-react'
import { fetchVisitWithPatient } from '@/app/actions/jadwal'
import { fetchAssessment, saveAssessmentDraft, completeAssessment } from '@/app/actions/assessments'
import type { VisitWithPatient } from '@/app/actions/jadwal'
import { PostAssessmentPackageDialog } from '@/components/visits/PostAssessmentPackageDialog'
import { StepProgress } from '@/components/assessment/StepProgress'
import { AssessmentFooter } from '@/components/assessment/AssessmentFooter'
import { VisitInfoBar } from '@/components/assessment/VisitInfoBar'
import type { VisitInfoState } from '@/components/assessment/VisitInfoBar'
import { StepInterview } from '@/components/assessment/StepInterview'
import { StepPhysicalExam } from '@/components/assessment/StepPhysicalExam'
import { StepNeuroScreening } from '@/components/assessment/StepNeuroScreening'
import { StepOutcomeMeasures } from '@/components/assessment/StepOutcomeMeasures'
import { StepClinicalReasoning } from '@/components/assessment/StepClinicalReasoning'
import { StepPlanOfCare } from '@/components/assessment/StepPlanOfCare'
import { STEP_LABELS, fromAssessment, toFieldsInput } from '@/components/assessment/types'
import type { AssessmentFormState } from '@/components/assessment/types'

export default function TerapiAwalAssessmentPage() {
  const { visitId } = useParams<{ visitId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const backTo = searchParams.get('from') || '/jadwal-harian'

  const [loading, setLoading]       = useState(true)
  const [visit, setVisit]           = useState<VisitWithPatient | null>(null)
  const [form, setForm]             = useState<AssessmentFormState | null>(null)
  const [visitInfo, setVisitInfo]   = useState<VisitInfoState>({ shift: '', kehadiran: '', regio: '', sumber_pasien: '' })
  const [alreadyCompleted, setAlreadyCompleted] = useState(false)

  const [currentStep, setCurrentStep]   = useState(0)
  const [furthestStep, setFurthestStep] = useState(0)
  const [saving, setSaving]         = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [showPackagePrompt, setShowPackagePrompt] = useState(false)

  useEffect(() => {
    if (!visitId) return
    let cancelled = false
    setLoading(true)
    Promise.all([fetchVisitWithPatient(visitId), fetchAssessment(visitId)]).then(([v, a]) => {
      if (cancelled) return
      if (!v || v.service_type !== 'TERAPI AWAL') {
        router.replace(backTo)
        return
      }
      setVisit(v)
      setForm(fromAssessment(a))
      setAlreadyCompleted(a?.status === 'completed')
      setVisitInfo({
        shift: v.shift ?? '',
        kehadiran: v.kehadiran ?? '',
        regio: v.regio ?? '',
        sumber_pasien: v.sumber_pasien ?? '',
      })
      setLoading(false)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId])

  function patchForm(patch: Partial<AssessmentFormState>) {
    setForm((f) => f ? { ...f, ...patch } : f)
  }

  async function persistDraft() {
    if (!visit || !form) return false
    setSaving(true)
    setError(null)
    const { error: err } = await saveAssessmentDraft(visit.id, visit.patient_id, visit.branch_id, toFieldsInput(form))
    setSaving(false)
    if (err) { setError(err); return false }
    return true
  }

  async function handleNext() {
    const ok = await persistDraft()
    if (!ok) return
    setCurrentStep((s) => {
      const next = Math.min(s + 1, STEP_LABELS.length - 1)
      setFurthestStep((f) => Math.max(f, next))
      return next
    })
  }

  function handleBack() {
    setCurrentStep((s) => Math.max(s - 1, 0))
  }

  function handleJumpStep(step: number) {
    setCurrentStep(step)
  }

  async function handleComplete() {
    if (!visit || !form) return
    if (!visitInfo.regio) { setError('Regio wajib dipilih pada Info Kunjungan sebelum menyelesaikan asesmen.'); return }
    if (!form.diagnosis_hypothesis.trim()) { setError('Physiotherapy Diagnosis / Hypothesis wajib diisi (Langkah 5).'); return }
    if (!form.treatment_plan_today.trim()) { setError('Treatment Plan for Today wajib diisi (Langkah 6).'); return }

    setCompleting(true)
    setError(null)
    const { error: err } = await completeAssessment(
      visit.id, visit.patient_id, visit.branch_id, toFieldsInput(form), visitInfo,
    )
    setCompleting(false)
    if (err) { setError(err); return }

    setAlreadyCompleted(true)
    if (visit.service_type === 'TERAPI AWAL') {
      setShowPackagePrompt(true)
    } else {
      router.push(backTo)
    }
  }

  if (loading || !visit || !form) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  const StepComponent = [
    StepInterview,
    StepPhysicalExam,
    StepNeuroScreening,
    StepOutcomeMeasures,
    StepClinicalReasoning,
    StepPlanOfCare,
  ][currentStep]

  return (
    <div className="space-y-5 j-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={backTo}
            className="p-2 rounded-xl border border-border hover:bg-muted transition-colors shrink-0"
          >
            <ChevronLeft size={16} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-foreground truncate">{visit.patient_name}</h1>
            <p className="text-xs text-muted-foreground">
              Guided MSK &amp; Sports Assessment · {visit.visit_date}
              {alreadyCompleted && <span className="ml-2 text-[#34C759] font-medium">Selesai</span>}
            </p>
          </div>
        </div>
      </div>

      <VisitInfoBar visitId={visit.id} value={visitInfo} onChange={setVisitInfo} />

      <div className="glass-card p-4 sm:p-6 space-y-5">
        <StepProgress currentStep={currentStep} furthestStep={furthestStep} onJump={handleJumpStep} />

        <StepComponent value={form} onChange={patchForm} />

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle size={12} /> {error}
          </p>
        )}

        <AssessmentFooter
          currentStep={currentStep}
          saving={saving}
          completing={completing}
          onBack={handleBack}
          onNext={handleNext}
          onSaveDraft={persistDraft}
          onComplete={handleComplete}
        />
      </div>

      {showPackagePrompt && (
        <PostAssessmentPackageDialog
          patientId={visit.patient_id}
          patientName={visit.patient_name}
          branchId={visit.branch_id}
          sourceServiceType={visit.service_type ?? 'TERAPI AWAL'}
          onClose={() => { setShowPackagePrompt(false); router.push(backTo) }}
          onSuccess={() => { setShowPackagePrompt(false); router.push(backTo) }}
        />
      )}
    </div>
  )
}
