'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripHtml } from '@/lib/richtext'
import { getVisitFormRoute } from '@/lib/visitRouting'
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
// Read with the service role once the caller has proven (through RLS) that they
// can open the current visit — therapists otherwise miss notes their branch
// policy doesn't surface (e.g. sessions recorded under another branch), which
// left the button disabled for them while admin/management could use it.
export async function fetchPreviousSessionNote(
  patientId: string,
  excludeVisitId: string,
): Promise<SessionNote | null> {
  const supabase = await createClient()
  const { data: visit } = await supabase
    .from('patient_visits')
    .select('id, patient_id')
    .eq('id', excludeVisitId)
    .maybeSingle()
  if (!visit || visit.patient_id !== patientId) return null

  const { data, error } = await createAdminClient()
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

// ── Autosave: persist the in-progress form as a draft (no patient_visits sync) ──
export async function saveSessionNoteDraft(
  visitId: string,
  patientId: string,
  branchId: string,
  fields: SessionNoteFieldsInput,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  const { data: existing } = await supabase
    .from('session_notes')
    .select('status')
    .eq('visit_id', visitId)
    .maybeSingle()

  // Drafts never overwrite a completed note — edits to those go through
  // completeSessionNote(), which enforces the therapist lock.
  if (existing?.status === 'completed') return { error: null }

  const { error } = await supabase
    .from('session_notes')
    .upsert(
      {
        visit_id: visitId,
        patient_id: patientId,
        branch_id: branchId,
        created_by: user.id,
        status: 'draft',
        ...fields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'visit_id' },
    )

  return { error: error?.message ?? null }
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

// ── Prev/next medical record of the same patient (RM navigation buttons) ──────
export interface AdjacentRecord {
  visitId: string
  route: 'assessment' | 'session-note'
  visitDate: string
}

export async function fetchAdjacentRecords(
  visitId: string,
): Promise<{ prev: AdjacentRecord | null; next: AdjacentRecord | null }> {
  const none = { prev: null, next: null }
  const supabase = await createClient()
  const { data: current } = await supabase
    .from('patient_visits')
    .select('patient_id')
    .eq('id', visitId)
    .maybeSingle()
  if (!current) return none

  // Same order as the patient's visit history table, oldest → newest.
  const { data: visits } = await supabase
    .from('patient_visits')
    .select('id, branch_id, visit_date, visit_time, created_at, service_type, status')
    .eq('patient_id', current.patient_id)
    .neq('status', 'cancelled')
    .order('visit_date', { ascending: true })
    .order('visit_time', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
  if (!visits?.length) return none

  // Griya Anak branches use their own forms — never step into those here.
  const branchIds = [...new Set(visits.map((v) => v.branch_id as string))]
  const { data: griya } = await supabase
    .from('branch_griya_settings').select('branch_id').eq('enabled', true).in('branch_id', branchIds)
  const griyaBranches = new Set((griya ?? []).map((g) => g.branch_id as string))

  const records = visits
    .map((v) => ({ v, route: getVisitFormRoute(v.service_type) }))
    .filter((r): r is { v: typeof visits[number]; route: 'assessment' | 'session-note' } =>
      !!r.route && !griyaBranches.has(r.v.branch_id as string))
  const idx = records.findIndex((r) => r.v.id === visitId)
  if (idx === -1) return none

  const toAdjacent = (r: (typeof records)[number] | undefined): AdjacentRecord | null =>
    r ? { visitId: r.v.id as string, route: r.route, visitDate: r.v.visit_date as string } : null
  return { prev: toAdjacent(records[idx - 1]), next: toAdjacent(records[idx + 1]) }
}
