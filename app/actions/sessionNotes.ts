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

// ── Session context: which visit number this is, package vs. standalone ────────
export interface SessionContext {
  sessionNumber: number
  totalSessions: number | null   // null when not a package
  isPackage: boolean
}

export async function fetchSessionContext(
  visitId: string,
  patientId: string,
  packageId: string | null,
): Promise<SessionContext> {
  const supabase = await createClient()

  function rank(rows: { id: string; visit_date: string; visit_time: string | null }[]): number {
    const sorted = [...rows].sort((a, b) => {
      const da = `${a.visit_date} ${a.visit_time ?? '00:00'}`
      const db = `${b.visit_date} ${b.visit_time ?? '00:00'}`
      return da.localeCompare(db)
    })
    const idx = sorted.findIndex((v) => v.id === visitId)
    return idx >= 0 ? idx + 1 : 1
  }

  if (packageId) {
    const [{ data: pkgVisits }, { data: pkg }] = await Promise.all([
      supabase
        .from('patient_visits')
        .select('id, visit_date, visit_time')
        .eq('package_id', packageId)
        .neq('status', 'cancelled'),
      supabase.from('patient_packages').select('total_sessions').eq('id', packageId).maybeSingle(),
    ])
    return {
      sessionNumber: rank(pkgVisits ?? []),
      totalSessions: pkg?.total_sessions ?? null,
      isPackage: true,
    }
  }

  const { data: visits } = await supabase
    .from('patient_visits')
    .select('id, visit_date, visit_time')
    .eq('patient_id', patientId)
    .neq('status', 'cancelled')
    .is('package_id', null)

  return {
    sessionNumber: rank(visits ?? []),
    totalSessions: null,
    isPackage: false,
  }
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

// Therapists/staff can't resubmit a note that's already completed — keeps the
// record from being silently rewritten after the fact. Admin/manager/director
// retain the ability to correct a mistake.
const LOCKED_FOR_ROLES = ['therapist', 'staff', 'sport_massage_therapist']

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
  if (!user) return { error: 'Tidak terautentikasi' }

  const [{ data: profile }, { data: existing }] = await Promise.all([
    supabase.from('internal_profiles').select('role').eq('id', user.id).single(),
    supabase.from('session_notes').select('status').eq('visit_id', visitId).maybeSingle(),
  ])
  if (existing?.status === 'completed' && LOCKED_FOR_ROLES.includes(profile?.role ?? '')) {
    return { error: 'Rekam medis sudah dikunci setelah disimpan. Hubungi admin/manajer untuk perubahan.' }
  }

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
  const treatment = [treatmentLabels, stripHtml(fields.treatment_notes), stripHtml(fields.hep_given)].filter(Boolean).join(' — ') || null

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
      diagnosis: stripHtml(fields.clinical_impression) || null,
      treatment,
      chief_complaint: stripHtml(fields.subjective_notes),
      updated_at: new Date().toISOString(),
    })
    .eq('id', visitId)

  return { error: visitErr?.message ?? null }
}
