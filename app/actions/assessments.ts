'use server'

import { createClient } from '@/lib/supabase/server'
import { stripHtml } from '@/lib/richtext'
import type { TerapiAwalAssessment, VisitStatus } from '@/types'

export type AssessmentFieldsInput = Partial<Omit<TerapiAwalAssessment,
  'id' | 'visit_id' | 'patient_id' | 'branch_id' | 'status' | 'created_by' | 'created_at' | 'updated_at'
>>

export interface VisitInfoInput {
  shift: string | null
  kehadiran: string | null
  regio: string | null
  sumber_pasien: string | null
}

// ── Fetch the assessment draft/completed row for a visit (may not exist yet) ──
export async function fetchAssessment(visitId: string): Promise<TerapiAwalAssessment | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('terapi_awal_assessments')
    .select('*')
    .eq('visit_id', visitId)
    .maybeSingle()

  if (error || !data) return null
  return data as TerapiAwalAssessment
}

// ── Save the full current form state as a draft (called on step change) ──────
export async function saveAssessmentDraft(
  visitId: string,
  patientId: string,
  branchId: string,
  fields: AssessmentFieldsInput,
): Promise<{ error: string | null; assessment?: TerapiAwalAssessment }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: existing } = await supabase
    .from('terapi_awal_assessments')
    .select('status')
    .eq('visit_id', visitId)
    .maybeSingle()

  // Never downgrade an already-completed assessment back to draft.
  const status = existing?.status === 'completed' ? 'completed' : 'draft'

  const { data, error } = await supabase
    .from('terapi_awal_assessments')
    .upsert(
      {
        visit_id: visitId,
        patient_id: patientId,
        branch_id: branchId,
        created_by: user?.id ?? null,
        status,
        ...fields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'visit_id' },
    )
    .select()
    .single()

  if (error) return { error: error.message }
  return { error: null, assessment: data as TerapiAwalAssessment }
}

// ── Complete the assessment and sync a plain-text synopsis onto patient_visits ─
export async function completeAssessment(
  visitId: string,
  patientId: string,
  branchId: string,
  fields: AssessmentFieldsInput,
  visitInfo: VisitInfoInput,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error: assessmentErr } = await supabase
    .from('terapi_awal_assessments')
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

  if (assessmentErr) return { error: assessmentErr.message }

  const diagnosis = stripHtml(fields.diagnosis_hypothesis)
  const treatment = stripHtml(fields.treatment_plan_today)
  const chiefComplaint = stripHtml(fields.npips) ?? stripHtml(fields.history_moi)

  const { error: visitErr } = await supabase
    .from('patient_visits')
    .update({
      status: 'completed' satisfies VisitStatus,
      shift: visitInfo.shift || null,
      kehadiran: visitInfo.kehadiran || 'HADIR',
      regio: visitInfo.regio || null,
      sumber_pasien: visitInfo.sumber_pasien || null,
      diagnosis,
      treatment,
      chief_complaint: chiefComplaint,
      updated_at: new Date().toISOString(),
    })
    .eq('id', visitId)

  return { error: visitErr?.message ?? null }
}
