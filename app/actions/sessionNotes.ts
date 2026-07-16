'use server'

import { createClient } from '@/lib/supabase/server'
import { stripHtml } from '@/lib/richtext'
import { TREATMENTS_PERFORMED_LABEL } from '@/components/sessionNote/types'
import type { SessionNote, TerapiAwalAssessment, VisitStatus } from '@/types'

export type SessionNoteFieldsInput = Partial<Omit<SessionNote,
  'id' | 'visit_id' | 'patient_id' | 'branch_id' | 'status' | 'created_by' | 'created_at' | 'updated_at'
>>

export interface VisitInfoInput {
  shift: string | null
  kehadiran: string | null
  regio: string | null
  sumber_pasien: string | null
}

// ── Fetch the note for a visit (supports re-opening/editing after completion) ──
export async function fetchSessionNote(visitId: string): Promise<SessionNote | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('session_notes')
    .select('*')
    .eq('visit_id', visitId)
    .maybeSingle()

  if (error || !data) return null
  return data as SessionNote
}

// ── Pull-forward context: most recent completed TERAPI AWAL/TA VISIT assessment ─
export async function fetchLatestCompletedAssessment(patientId: string): Promise<TerapiAwalAssessment | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('terapi_awal_assessments')
    .select('*')
    .eq('patient_id', patientId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data as TerapiAwalAssessment
}

// ── Copy-from-previous: most recent completed session note for this patient ────
export async function fetchPreviousSessionNote(
  patientId: string,
  excludeVisitId: string,
): Promise<SessionNote | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('session_notes')
    .select('*')
    .eq('patient_id', patientId)
    .eq('status', 'completed')
    .neq('visit_id', excludeVisitId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data as SessionNote
}

// ── Single-shot save: upsert as completed, then sync patient_visits ────────────
export async function completeSessionNote(
  visitId: string,
  patientId: string,
  branchId: string,
  fields: SessionNoteFieldsInput,
  visitInfo: VisitInfoInput,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error: noteErr } = await supabase
    .from('session_notes')
    .upsert(
      {
        visit_id: visitId,
        patient_id: patientId,
        branch_id: branchId,
        created_by: user?.id ?? null,
        status: 'completed',
        ...fields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'visit_id' },
    )

  if (noteErr) return { error: noteErr.message }

  const treatmentLabels = (fields.treatments_performed ?? []).map((t) => TREATMENTS_PERFORMED_LABEL[t]).join(', ')
  const treatment = [treatmentLabels, stripHtml(fields.hep_given)].filter(Boolean).join(' — ') || null

  // Regio isn't set anywhere at scheduling time for follow-up visits — carry it
  // forward from the patient's most recent visit that has one, so the therapist
  // never has to re-pick it and the "Rekam Medis Belum Diisi" reminder doesn't
  // permanently flag every follow-up session.
  let regio = visitInfo.regio
  if (!regio) {
    const { data: prior } = await supabase
      .from('patient_visits')
      .select('regio')
      .eq('patient_id', patientId)
      .not('regio', 'is', null)
      .neq('id', visitId)
      .order('visit_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    regio = prior?.regio ?? null
  }

  const { error: visitErr } = await supabase
    .from('patient_visits')
    .update({
      status: 'completed' satisfies VisitStatus,
      shift: visitInfo.shift || null,
      kehadiran: visitInfo.kehadiran || 'HADIR',
      regio,
      sumber_pasien: visitInfo.sumber_pasien || null,
      diagnosis: fields.clinical_impression || null,
      treatment,
      chief_complaint: stripHtml(fields.subjective_notes),
      updated_at: new Date().toISOString(),
    })
    .eq('id', visitId)

  return { error: visitErr?.message ?? null }
}
