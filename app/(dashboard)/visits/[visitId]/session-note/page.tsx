'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2, Printer, Copy, History, FileHeart, Share2 } from 'lucide-react'
import { fetchVisitWithPatient } from '@/app/actions/jadwal'
import {
  fetchSessionNote, fetchLatestCompletedAssessment, fetchPreviousSessionNote, completeSessionNote,
} from '@/app/actions/sessionNotes'
import { getOrCreateResumeLink } from '@/app/actions/resumeLinks'
import type { VisitWithPatient } from '@/app/actions/jadwal'
import type { SessionNote, TerapiAwalAssessment } from '@/types'
import { SingleStepSessionNoteForm } from '@/components/sessionNote/SingleStepSessionNoteForm'
import { MultiStepSessionNoteForm } from '@/components/sessionNote/MultiStepSessionNoteForm'
import { generateSessionNotePdf } from '@/components/sessionNote/generateSessionNotePdf'
import { generateSessionNoteResumePdf } from '@/components/sessionNote/generateSessionNoteResumePdf'
import { fromSessionNote, toFieldsInput } from '@/components/sessionNote/types'
import type { SessionNoteFormState } from '@/components/sessionNote/types'
import { stripHtml } from '@/lib/richtext'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/context/ToastContext'

type FormMode = 'single_step' | 'multi_step'

export default function SessionNotePage() {
  const { visitId } = useParams<{ visitId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const backTo = searchParams.get('from') || '/jadwal-harian'
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [visit, setVisit]     = useState<VisitWithPatient | null>(null)
  const [form, setForm]       = useState<SessionNoteFormState | null>(null)
  const [alreadyCompleted, setAlreadyCompleted] = useState(false)
  const [completedNote, setCompletedNote] = useState<SessionNote | null>(null)

  const [priorAssessment, setPriorAssessment] = useState<TerapiAwalAssessment | null>(null)
  const [previousNote, setPreviousNote]       = useState<SessionNote | null>(null)

  const [sharing, setSharing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [formMode, setFormMode] = useState<FormMode | null>(null)

  useEffect(() => {
    if (!visitId) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchVisitWithPatient(visitId),
      fetchSessionNote(visitId),
      createClient().from('session_note_settings').select('form_mode').eq('id', 1).single(),
    ]).then(([v, n, settings]) => {
      if (cancelled) return
      setFormMode((settings.data?.form_mode as FormMode) ?? 'single_step')
      if (!v || (v.service_type !== 'SESI TERAPI' && v.service_type !== 'PAKET TERAPI'
        && v.service_type !== 'SESI VISIT' && v.service_type !== 'PAKET VISIT')) {
        router.replace(backTo)
        return
      }
      setVisit(v)
      setForm(fromSessionNote(n))
      setAlreadyCompleted(n?.status === 'completed')
      setCompletedNote(n?.status === 'completed' ? n : null)
      setLoading(false)

      fetchLatestCompletedAssessment(v.patient_id).then((a) => { if (!cancelled) setPriorAssessment(a) })
      fetchPreviousSessionNote(v.patient_id, v.id).then((p) => { if (!cancelled) setPreviousNote(p) })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId])

  function patchForm(patch: Partial<SessionNoteFormState>) {
    setForm((f) => f ? { ...f, ...patch } : f)
  }

  function handleCopyPrevious() {
    if (!previousNote) return
    const prevDate = new Date(previousNote.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    const ok = window.confirm(`Salin data dari sesi tanggal ${prevDate}? Ini akan menimpa isian saat ini.`)
    if (!ok) return
    setForm(fromSessionNote(previousNote))
  }

  async function handleComplete() {
    if (!visit || !form) return
    if (!stripHtml(form.clinical_impression)) { setError('Clinical Impression / Physio Diagnosis wajib diisi.'); return }

    setSaving(true)
    setError(null)
    const { error: err } = await completeSessionNote(
      visit.id, visit.patient_id, visit.branch_id, toFieldsInput(form),
      { shift: visit.shift, kehadiran: visit.kehadiran, regio: visit.regio, sumber_pasien: visit.sumber_pasien },
    )
    setSaving(false)
    if (err) { setError(err); return }

    router.push(backTo)
  }

  function handlePrint() {
    if (!visit || !completedNote) return
    generateSessionNotePdf(visit, completedNote, priorAssessment)
  }

  function handlePrintResume() {
    if (!visit || !completedNote) return
    generateSessionNoteResumePdf(visit, completedNote)
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

  if (loading || !visit || !form || !formMode) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

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
              Catatan Perawatan (SOAP) · {visit.visit_date}
              {alreadyCompleted && <span className="ml-2 text-[#34C759] font-medium">Selesai</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Link
            href={`/patients/${visit.patient_id}/visits`}
            title="Riwayat Pasien"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors"
          >
            <History size={13} /> <span className="hidden sm:inline">Riwayat Pasien</span>
          </Link>
          <button
            type="button"
            onClick={handleCopyPrevious}
            disabled={!previousNote}
            title={previousNote ? 'Salin dari Sesi Sebelumnya' : 'Belum ada sesi sebelumnya'}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <Copy size={13} /> <span className="hidden sm:inline">Salin dari Sesi Sebelumnya</span>
          </button>
          {alreadyCompleted && (
            <>
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
            </>
          )}
        </div>
      </div>

      {priorAssessment && (
        <div className="glass-card p-4 bg-primary/5 border-primary/20">
          <p className="text-xs font-semibold text-primary mb-1">Konteks Asesmen Awal</p>
          <p className="text-xs text-muted-foreground">
            {priorAssessment.diagnosis_primer || '—'}
          </p>
        </div>
      )}

      {formMode === 'multi_step' ? (
        <MultiStepSessionNoteForm form={form} patchForm={patchForm} error={error} saving={saving} onSubmit={handleComplete} />
      ) : (
        <SingleStepSessionNoteForm form={form} patchForm={patchForm} error={error} saving={saving} onSubmit={handleComplete} />
      )}
    </div>
  )
}
