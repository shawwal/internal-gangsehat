'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2, AlertTriangle, Printer, Copy } from 'lucide-react'
import { fetchVisitWithPatient } from '@/app/actions/jadwal'
import {
  fetchSessionNote, fetchLatestCompletedAssessment, fetchPreviousSessionNote, completeSessionNote,
} from '@/app/actions/sessionNotes'
import type { VisitWithPatient } from '@/app/actions/jadwal'
import type { SessionNote, TerapiAwalAssessment } from '@/types'
import { SectionSubjective } from '@/components/sessionNote/SectionSubjective'
import { SectionObjective } from '@/components/sessionNote/SectionObjective'
import { SectionAssessment } from '@/components/sessionNote/SectionAssessment'
import { SectionPlan } from '@/components/sessionNote/SectionPlan'
import { generateSessionNotePdf } from '@/components/sessionNote/generateSessionNotePdf'
import { fromSessionNote, toFieldsInput } from '@/components/sessionNote/types'
import type { SessionNoteFormState } from '@/components/sessionNote/types'

export default function SessionNotePage() {
  const { visitId } = useParams<{ visitId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const backTo = searchParams.get('from') || '/jadwal-harian'

  const [loading, setLoading] = useState(true)
  const [visit, setVisit]     = useState<VisitWithPatient | null>(null)
  const [form, setForm]       = useState<SessionNoteFormState | null>(null)
  const [alreadyCompleted, setAlreadyCompleted] = useState(false)
  const [completedNote, setCompletedNote] = useState<SessionNote | null>(null)

  const [priorAssessment, setPriorAssessment] = useState<TerapiAwalAssessment | null>(null)
  const [previousNote, setPreviousNote]       = useState<SessionNote | null>(null)

  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!visitId) return
    let cancelled = false
    setLoading(true)
    Promise.all([fetchVisitWithPatient(visitId), fetchSessionNote(visitId)]).then(([v, n]) => {
      if (cancelled) return
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
    if (!form.clinical_impression.trim()) { setError('Clinical Impression / Physio Diagnosis wajib diisi.'); return }

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

  if (loading || !visit || !form) {
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
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyPrevious}
            disabled={!previousNote}
            title={previousNote ? undefined : 'Belum ada sesi sebelumnya'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <Copy size={13} /> Salin dari Sesi Sebelumnya
          </button>
          {alreadyCompleted && (
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors"
            >
              <Printer size={13} /> Cetak PDF
            </button>
          )}
        </div>
      </div>

      {priorAssessment && (
        <div className="glass-card p-4 bg-primary/5 border-primary/20">
          <p className="text-xs font-semibold text-primary mb-1">Konteks Asesmen Awal</p>
          <div
            className="text-xs text-muted-foreground [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-4"
            dangerouslySetInnerHTML={{ __html: priorAssessment.diagnosis_hypothesis ?? '—' }}
          />
        </div>
      )}

      <div className="glass-card p-4 sm:p-6 space-y-6">
        <SectionSubjective value={form} onChange={patchForm} />
        <SectionObjective value={form} onChange={patchForm} />
        <SectionAssessment value={form} onChange={patchForm} />
        <SectionPlan value={form} onChange={patchForm} />

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle size={12} /> {error}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleComplete}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1.5"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            Simpan Catatan Perawatan
          </button>
        </div>
      </div>
    </div>
  )
}
