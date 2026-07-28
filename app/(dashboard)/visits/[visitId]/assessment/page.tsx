'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/context/ToastContext'
import { ChevronLeft, Loader2, AlertTriangle, Printer, FileHeart, Share2 } from 'lucide-react'
import { fetchVisitWithPatient } from '@/app/actions/jadwal'
import { fetchAssessment, saveAssessmentDraft, completeAssessment } from '@/app/actions/assessments'
import { getOrCreateResumeLink } from '@/app/actions/resumeLinks'
import type { VisitWithPatient } from '@/app/actions/jadwal'
import type { TerapiAwalAssessment, UserRole } from '@/types'
import { PostAssessmentPackageDialog } from '@/components/visits/PostAssessmentPackageDialog'
import { generateAssessmentPdf } from '@/components/assessment/generateAssessmentPdf'
import { generatePatientResumePdf } from '@/components/assessment/generatePatientResumePdf'
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
import { SingleStepAssessmentForm } from '@/components/assessment/SingleStepAssessmentForm'
import { createClient } from '@/lib/supabase/client'

type FormMode = 'single_step' | 'multi_step'

export default function TerapiAwalAssessmentPage() {
  const { visitId } = useParams<{ visitId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const backTo = searchParams.get('from') || '/jadwal-harian'
  const { showToast } = useToast()

  const [loading, setLoading]       = useState(true)
  const [visit, setVisit]           = useState<VisitWithPatient | null>(null)
  const [form, setForm]             = useState<AssessmentFormState | null>(null)
  const [visitInfo, setVisitInfo]   = useState<VisitInfoState>({ shift: '', kehadiran: '', regio: '', sumber_pasien: '' })
  const [alreadyCompleted, setAlreadyCompleted] = useState(false)
  const [completedAssessment, setCompletedAssessment] = useState<TerapiAwalAssessment | null>(null)

  const [currentStep, setCurrentStep]   = useState(0)
  const [furthestStep, setFurthestStep] = useState(0)
  const [saving, setSaving]         = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [showPackagePrompt, setShowPackagePrompt] = useState(false)
  const [sharing, setSharing]       = useState(false)
  const [formMode, setFormMode]     = useState<FormMode | null>(null)
  const [userRole, setUserRole]     = useState<UserRole | null>(null)

  const canRecordPayment = !!userRole && ['finance', 'manager', 'director', 'admin'].includes(userRole)

  const topRef = useRef<HTMLDivElement>(null)
  const isFirstStepRender = useRef(true)

  // Scroll back to the top of the step whenever the user moves between
  // steps — otherwise the next step renders wherever the previous one
  // left the scroll position (often mid-form on mobile).
  useEffect(() => {
    if (isFirstStepRender.current) { isFirstStepRender.current = false; return }
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [currentStep])

  useEffect(() => {
    if (!visitId) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchVisitWithPatient(visitId),
      fetchAssessment(visitId),
      createClient().from('session_note_settings').select('assessment_form_mode').eq('id', 1).single(),
    ]).then(([v, a, settings]) => {
      if (cancelled) return
      setFormMode((settings.data?.assessment_form_mode as FormMode) ?? 'single_step')
      if (!v || v.service_type !== 'TERAPI AWAL') {
        router.replace(backTo)
        return
      }
      setVisit(v)
      setForm(fromAssessment(a))
      setAlreadyCompleted(a?.status === 'completed')
      setCompletedAssessment(a?.status === 'completed' ? a : null)
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

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase
        .from('internal_profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (!cancelled) setUserRole((profile?.role as UserRole) ?? null)
    })
    return () => { cancelled = true }
  }, [])

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

  function handlePrint() {
    if (!visit || !completedAssessment) return
    generateAssessmentPdf(visit, completedAssessment)
  }

  function handlePrintResume() {
    if (!visit || !completedAssessment) return
    generatePatientResumePdf(visit, completedAssessment)
  }

  async function handleShareResume() {
    if (!visit) return
    setSharing(true)
    const { url, error: err } = await getOrCreateResumeLink(visit.id)
    setSharing(false)
    if (err || !url) { showToast(err || 'Gagal membuat link resume', 'error'); return }
    try {
      await navigator.clipboard.writeText(url)
      showToast('Link resume disalin ke clipboard', 'success')
    } catch {
      showToast(url, 'info')
    }
  }

  async function handleComplete() {
    if (!visit || !form) return
    if (!visitInfo.regio) { setError('Regio wajib dipilih pada Info Kunjungan sebelum menyelesaikan asesmen.'); return }
    if (!form.diagnosis_primer.trim()) { setError('Diagnosa Primer wajib diisi (Langkah 5).'); return }
    if (!form.treatment_plan_today.trim()) { setError('Treatment Plan for Today wajib diisi (Langkah 6).'); return }

    setCompleting(true)
    setError(null)
    const { error: err } = await completeAssessment(
      visit.id, visit.patient_id, visit.branch_id, toFieldsInput(form), visitInfo,
    )
    setCompleting(false)
    if (err) { setError(err); return }

    setAlreadyCompleted(true)
    if (visit.service_type === 'TERAPI AWAL' && canRecordPayment) {
      setShowPackagePrompt(true)
    } else {
      router.push(backTo)
    }
  }

  if (loading || !visit || !form || !formMode) {
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
        {alreadyCompleted && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handlePrint}
              title="Cetak PDF klinis"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors"
            >
              <Printer size={13} /> <span className="hidden sm:inline">Cetak PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrintResume}
              title="Cetak resume untuk pasien"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors"
            >
              <FileHeart size={13} /> <span className="hidden sm:inline">Cetak Resume</span>
            </button>
            <button
              type="button"
              onClick={handleShareResume}
              disabled={sharing}
              title="Salin link resume untuk dibagikan ke pasien"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-60"
            >
              {sharing ? <Loader2 size={13} className="animate-spin" /> : <Share2 size={13} />}
              <span className="hidden sm:inline">Bagikan ke Pasien</span>
            </button>
          </div>
        )}
      </div>

      <VisitInfoBar visitId={visit.id} value={visitInfo} onChange={setVisitInfo} />

      {formMode === 'multi_step' ? (
        <div className="glass-card p-4 sm:p-6 space-y-5">
          <div ref={topRef} className="scroll-mt-4" />
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
      ) : (
        <SingleStepAssessmentForm
          form={form}
          patchForm={patchForm}
          error={error}
          saving={saving}
          completing={completing}
          onSaveDraft={persistDraft}
          onComplete={handleComplete}
        />
      )}

      {showPackagePrompt && (
        <PostAssessmentPackageDialog
          patientId={visit.patient_id}
          patientName={visit.patient_name}
          branchId={visit.branch_id}
          visitId={visit.id}
          sourceServiceType={visit.service_type ?? 'TERAPI AWAL'}
          onClose={() => { setShowPackagePrompt(false); router.push(backTo) }}
          onSuccess={() => { setShowPackagePrompt(false); router.push(backTo) }}
        />
      )}
    </div>
  )
}
