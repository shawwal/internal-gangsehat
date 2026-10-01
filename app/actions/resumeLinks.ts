'use server'

import { randomBytes } from 'crypto'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPatientPII } from '@/lib/encryption'

// ── Types ──────────────────────────────────────────────────────────────────────
export interface PublicResumeData {
  patientName: string
  visitDate: string
  chiefComplaint: string | null
  diagnosis: string | null
  plan: string | null
  // Full name shown in the signature block; null falls back to a generic label.
  therapistName: string | null
}

type AdminClient = ReturnType<typeof createAdminClient>

// The physiotherapist who wrote the record behind a resume. `created_by` is
// rewritten on every save, so an admin/manager correcting a completed record
// would otherwise sign it — the record's author only wins while they are a
// therapist, else the visit's attending therapist does.
async function resolveResumeTherapistName(
  admin: AdminClient,
  recordAuthorId: string | null,
  attendingStaffId: string | null,
): Promise<string | null> {
  const ids = [...new Set([recordAuthorId, attendingStaffId].filter((id): id is string => !!id))]
  if (ids.length === 0) return null

  const { data: profiles } = await admin
    .from('internal_profiles')
    .select('id, full_name, role')
    .in('id', ids)
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]))

  const author = recordAuthorId ? byId.get(recordAuthorId) : undefined
  const attending = attendingStaffId ? byId.get(attendingStaffId) : undefined
  const signer = author?.role === 'therapist' ? author : attending ?? author
  return (signer?.full_name as string | undefined)?.trim() || null
}

// ── Staff: therapist name for the "Download Resume" signature ────────────────
// The visit is read with the caller's own session first, so RLS decides who
// may ask; only the name lookup uses the admin client, because most roles can
// read no internal_profiles row but their own.
export async function fetchResumeTherapistName(visitId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: visit } = await supabase
    .from('patient_visits')
    .select('id, attending_staff_id')
    .eq('id', visitId)
    .maybeSingle()
  if (!visit) return null

  const admin = createAdminClient()
  const [{ data: assessment }, { data: sessionNote }] = await Promise.all([
    admin.from('terapi_awal_assessments').select('created_by').eq('visit_id', visitId).maybeSingle(),
    admin.from('session_notes').select('created_by').eq('visit_id', visitId).maybeSingle(),
  ])

  return resolveResumeTherapistName(
    admin,
    assessment?.created_by ?? sessionNote?.created_by ?? null,
    visit.attending_staff_id,
  )
}

async function siteOrigin(): Promise<string> {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const host = h.get('x-forwarded-host') ?? h.get('host')
  return `${proto}://${host}`
}

// ── Staff: create or reuse a share link for a visit's resume ─────────────────
export async function getOrCreateResumeLink(visitId: string): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { url: null, error: 'Tidak terautentikasi' }

  const { data: visit, error: visitErr } = await supabase
    .from('patient_visits')
    .select('id, branch_id, diagnosis, treatment')
    .eq('id', visitId)
    .single()
  if (visitErr || !visit) return { url: null, error: 'Kunjungan tidak ditemukan' }
  if (!visit.diagnosis || !visit.treatment) {
    return { url: null, error: 'Diagnosis dan tindakan harus diisi sebelum membagikan resume' }
  }

  const { data: existing } = await supabase
    .from('resume_links')
    .select('token')
    .eq('visit_id', visitId)
    .is('revoked_at', null)
    .maybeSingle()

  const origin = await siteOrigin()

  if (existing) return { url: `${origin}/resume/${existing.token}`, error: null }

  const token = randomBytes(16).toString('hex')
  const { error: insertErr } = await supabase
    .from('resume_links')
    .insert({ visit_id: visitId, branch_id: visit.branch_id, token, created_by: user.id })

  if (insertErr) return { url: null, error: insertErr.message }
  return { url: `${origin}/resume/${token}`, error: null }
}

// ── Staff: revoke a visit's active share link ─────────────────────────────────
export async function revokeResumeLink(visitId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  const { error } = await supabase
    .from('resume_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('visit_id', visitId)
    .is('revoked_at', null)

  return { error: error?.message ?? null }
}

// ── Public: resolve a token into the narrow patient-facing resume payload ────
// No auth check — reachable from app/resume/[token]/page.tsx without a login.
// Uses the service-role admin client (bypasses RLS) since the visitor has no
// internal_profiles session; only the fields below are ever returned, never
// the full clinical row (no red flags / exam findings / phone / address).
export async function fetchPublicResume(token: string): Promise<PublicResumeData | null> {
  if (!token) return null
  const admin = createAdminClient()

  const { data: link } = await admin
    .from('resume_links')
    .select('visit_id, revoked_at')
    .eq('token', token)
    .maybeSingle()
  if (!link || link.revoked_at) return null

  const { data: visit } = await admin
    .from('patient_visits')
    .select('patient_id, visit_date, chief_complaint, diagnosis, treatment, attending_staff_id')
    .eq('id', link.visit_id)
    .maybeSingle()
  if (!visit) return null

  const { data: assessment } = await admin
    .from('terapi_awal_assessments')
    .select('history_moi, diagnosis_primer, icf_body_functions_notes, icf_activity_notes, short_term_goals, long_term_goals, created_by')
    .eq('visit_id', link.visit_id)
    .maybeSingle()

  // Follow-up (SESI/PAKET TERAPI|VISIT) visits have no terapi_awal_assessments
  // row — fall back to session_notes so shared links from those visits carry
  // the richer SOAP content instead of just the plain patient_visits columns.
  const { data: sessionNote } = assessment ? { data: null } : await admin
    .from('session_notes')
    .select('subjective_notes, clinical_impression, next_plan, hep_given, created_by')
    .eq('visit_id', link.visit_id)
    .maybeSingle()

  const { data: patient } = await admin
    .from('patients')
    .select('encrypted_name, encrypted_phone')
    .eq('id', visit.patient_id)
    .maybeSingle()

  let patientName = 'Pasien'
  if (patient) {
    try {
      const dec = decryptPatientPII({ encrypted_name: patient.encrypted_name ?? '', encrypted_phone: patient.encrypted_phone ?? '' })
      patientName = dec.name || 'Pasien'
    } catch { /* keep default */ }
  }

  const plan = assessment
    ? [assessment.short_term_goals, assessment.long_term_goals].filter(Boolean).join('') || visit.treatment
    : [sessionNote?.next_plan, sessionNote?.hep_given].filter(Boolean).join('') || visit.treatment

  const chiefComplaint = assessment
    ? [assessment.icf_body_functions_notes, assessment.icf_activity_notes].filter(Boolean).join('') || assessment.history_moi || visit.chief_complaint
    : sessionNote?.subjective_notes || visit.chief_complaint

  const therapistName = await resolveResumeTherapistName(
    admin,
    assessment?.created_by ?? sessionNote?.created_by ?? null,
    visit.attending_staff_id,
  )

  return {
    patientName,
    visitDate: visit.visit_date,
    chiefComplaint,
    diagnosis: assessment?.diagnosis_primer || sessionNote?.clinical_impression || visit.diagnosis,
    plan,
    therapistName,
  }
}
