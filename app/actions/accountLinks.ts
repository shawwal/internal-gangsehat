'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt, encrypt } from '@/lib/encryption'
import { phoneHashIfFree } from '@/lib/patientPhoneHash'
import { logActivity } from '@/lib/activityLog'

// "Hubungkan Akun" — gangsehat.com patients whose phone + birth date didn't
// auto-match a clinic record ask staff to connect their account
// (patient_link_requests, 110-online-booking.sql). Staff either link the
// account to an existing patient (link_patient_account moves everything over)
// or turn the account's own patients row into a new clinic record.

const REVIEW_ROLES = ['director', 'manager', 'admin']

interface Reviewer { id: string; role: string; branchId: string | null }

async function getReviewer(): Promise<Reviewer | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: me } = await supabase.from('internal_profiles').select('role, branch_id').eq('id', user.id).single()
  if (!me || !REVIEW_ROLES.includes(me.role)) return null
  return { id: user.id, role: me.role, branchId: me.branch_id }
}

function safeDecrypt(v: string | null): string {
  if (!v) return ''
  try { return decrypt(v) } catch { return '' }
}

export type LinkRequestStatus = 'pending' | 'approved' | 'rejected'

export interface LinkRequestRow {
  id: string
  createdAt: string
  name: string
  phone: string
  birthDate: string
  branchId: string | null
  branchName: string | null
  note: string | null
  status: LinkRequestStatus
  rejectionNote: string | null
  reviewerName: string | null
  reviewedAt: string | null
  webPatientId: string | null
  matchedPatient: { id: string; name: string; noRm: string | null } | null
  /** Clinic patient with the same phone number, if any (may already be linked to another account). */
  suggestion: LinkCandidate | null
}

export interface LinkCandidate {
  id: string
  name: string
  noRm: string | null
  birthDate: string
  /** Email of the gangsehat.com account this record is already connected to, if any. */
  linkedEmail: string | null
}

type Admin = ReturnType<typeof createAdminClient>

/** Clinic records → candidates, resolving which account (if any) already owns each. */
async function toCandidates(
  admin: Admin,
  rows: { id: string; encrypted_name: string; encrypted_birth_date: string | null; no_rm: string | null; profile_id: string | null }[],
): Promise<LinkCandidate[]> {
  const profileIds = [...new Set(rows.map((r) => r.profile_id).filter((v): v is string => !!v))]
  const emails = new Map<string, string>()
  if (profileIds.length > 0) {
    const { data } = await admin.from('profiles').select('id, email').in('id', profileIds)
    for (const p of data ?? []) emails.set(p.id, p.email)
  }
  return rows.map((p) => ({
    id: p.id,
    name: safeDecrypt(p.encrypted_name),
    noRm: p.no_rm,
    birthDate: safeDecrypt(p.encrypted_birth_date),
    linkedEmail: p.profile_id ? emails.get(p.profile_id) ?? 'akun lain' : null,
  }))
}

// Clinic records = rows staff created/approved (name_normalized set) or rows
// already linked; bare signup rows of other accounts are never candidates.
const CANDIDATE_COLS = 'id, encrypted_name, encrypted_birth_date, no_rm, profile_id, phone_hash'

export async function fetchLinkRequests(
  status: LinkRequestStatus,
): Promise<{ error: string | null; rows: LinkRequestRow[]; pending: number }> {
  const reviewer = await getReviewer()
  if (!reviewer) return { error: 'Tidak memiliki akses.', rows: [], pending: 0 }

  const admin = createAdminClient()
  const branchScoped = reviewer.role !== 'director' && !!reviewer.branchId

  let listQuery = admin
    .from('patient_link_requests')
    .select('*, branches!branch_id(name), reviewer:internal_profiles!reviewed_by(full_name), matched:patients!matched_patient_id(id, encrypted_name, no_rm)')
    .eq('status', status)
    .order('created_at', { ascending: status === 'pending' })
    .limit(100)
  let countQuery = admin.from('patient_link_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  if (branchScoped) {
    listQuery = listQuery.eq('branch_id', reviewer.branchId!)
    countQuery = countQuery.eq('branch_id', reviewer.branchId!)
  }
  const [{ data, error }, { count }] = await Promise.all([listQuery, countQuery])
  if (error) return { error: error.message, rows: [], pending: 0 }

  const hashes = [...new Set((data ?? []).map((r) => r.phone_hash).filter(Boolean))]
  const byHash = new Map<string, LinkCandidate>()
  if (hashes.length > 0) {
    const { data: matches } = await admin
      .from('patients')
      .select(CANDIDATE_COLS)
      .in('phone_hash', hashes)
      .eq('is_active', true)
    const candidates = await toCandidates(admin, matches ?? [])
    ;(matches ?? []).forEach((m, i) => byHash.set(m.phone_hash, candidates[i]))
  }

  const rows: LinkRequestRow[] = (data ?? []).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    name: safeDecrypt(r.encrypted_name),
    phone: safeDecrypt(r.encrypted_phone),
    birthDate: safeDecrypt(r.encrypted_birth_date),
    branchId: r.branch_id,
    branchName: r.branches?.name ?? null,
    note: r.note,
    status: r.status,
    rejectionNote: r.rejection_note,
    reviewerName: r.reviewer?.full_name ?? null,
    reviewedAt: r.reviewed_at,
    webPatientId: r.web_patient_id,
    matchedPatient: r.matched
      ? { id: r.matched.id, name: safeDecrypt(r.matched.encrypted_name), noRm: r.matched.no_rm }
      : null,
    // Never suggest the requester's own signup row.
    suggestion: r.phone_hash && byHash.get(r.phone_hash)?.id !== r.web_patient_id ? byHash.get(r.phone_hash) ?? null : null,
  }))
  return { error: null, rows, pending: count ?? 0 }
}

/**
 * Clinic patients by name or No. RM, including ones already connected to
 * another account (shown with that account's email so staff can move them).
 */
export async function searchPatientsForLink(term: string, excludeId?: string | null): Promise<LinkCandidate[]> {
  const reviewer = await getReviewer()
  const q = term.trim().toLowerCase().replace(/[%,()]/g, '')
  if (!reviewer || q.length < 2) return []
  const admin = createAdminClient()
  let query = admin
    .from('patients')
    .select(CANDIDATE_COLS)
    .eq('is_active', true)
    .or(`name_normalized.ilike.%${q}%,no_rm.ilike.%${q}%`)
    .order('name_normalized')
    .limit(15)
  if (excludeId) query = query.neq('id', excludeId)
  const { data } = await query
  return toCandidates(admin, data ?? [])
}

async function loadScopedRequest(reviewer: Reviewer, id: string) {
  const { data } = await createAdminClient()
    .from('patient_link_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  if (reviewer.role !== 'director' && data.branch_id !== reviewer.branchId) return null
  return data
}

/** Claim a pending request (two reviewers can't both act on it). */
async function claim(reviewer: Reviewer, id: string, patch: Record<string, unknown>) {
  const { data } = await createAdminClient()
    .from('patient_link_requests')
    .update({ ...patch, reviewed_by: reviewer.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
  return !!data && data.length > 0
}

async function release(id: string) {
  await createAdminClient()
    .from('patient_link_requests')
    .update({ status: 'pending', matched_patient_id: null, reviewed_by: null, reviewed_at: null })
    .eq('id', id)
}

const LINK_ERRORS: Record<string, string> = {
  target_already_linked: 'Pasien ini sudah terhubung dengan akun lain. Gunakan "Pindahkan ke akun ini".',
  target_not_found: 'Pasien tidak ditemukan.',
  web_not_found: 'Akun pasien sudah tidak tersedia.',
}

/**
 * Connect the request's account to a clinic record. If the record already
 * belongs to another account, `move` must be true: that account is detached
 * (relink_patient_account, migration 112) and this one takes over.
 */
export async function linkRequestToPatient(
  id: string,
  patientId: string,
  opts: { move?: boolean } = {},
): Promise<{ error: string | null }> {
  const reviewer = await getReviewer()
  if (!reviewer) return { error: 'Tidak memiliki akses.' }
  const req = await loadScopedRequest(reviewer, id)
  if (!req) return { error: 'Permintaan tidak ditemukan.' }
  if (!req.web_patient_id) return { error: 'Akun pasien sudah tidak tersedia.' }
  if (!(await claim(reviewer, id, { status: 'approved', matched_patient_id: patientId }))) {
    return { error: 'Permintaan sudah diproses.' }
  }

  const admin = createAdminClient()
  const { data: target } = await admin.from('patients').select('profile_id').eq('id', patientId).maybeSingle()
  const takenByOther = !!target?.profile_id && target.profile_id !== req.profile_id
  if (takenByOther && !opts.move) {
    await release(id)
    return { error: LINK_ERRORS.target_already_linked }
  }
  const { error } = takenByOther
    ? await admin.rpc('relink_patient_account', { p_web: req.web_patient_id, p_target: patientId })
    : await admin.rpc('link_patient_account', { p_web: req.web_patient_id, p_target: patientId })
  if (error) {
    await release(id)
    const code = Object.keys(LINK_ERRORS).find((k) => error.message.includes(k))
    return { error: code ? LINK_ERRORS[code] : error.message }
  }

  await logActivity({
    supabase: await createClient(), userId: reviewer.id, action: 'update', resourceType: 'account_link',
    resourceId: id, resourceLabel: safeDecrypt(req.encrypted_name), branchId: req.branch_id, patientId,
    oldValues: takenByOther ? { previous_profile_id: target!.profile_id } : undefined,
    newValues: { linked_patient_id: patientId, moved_from_other_account: takenByOther },
  })
  return { error: null }
}

/** No clinic record yet: the account's own patients row becomes the clinic record. */
export async function createPatientFromRequest(
  id: string,
  fields: { noRm: string; gender: 'male' | 'female' | null },
): Promise<{ error: string | null }> {
  const reviewer = await getReviewer()
  if (!reviewer) return { error: 'Tidak memiliki akses.' }
  const req = await loadScopedRequest(reviewer, id)
  if (!req) return { error: 'Permintaan tidak ditemukan.' }
  if (!req.web_patient_id) return { error: 'Akun pasien sudah tidak tersedia.' }
  if (!(await claim(reviewer, id, { status: 'approved', matched_patient_id: req.web_patient_id }))) {
    return { error: 'Permintaan sudah diproses.' }
  }

  const name = safeDecrypt(req.encrypted_name).trim()
  const phone = safeDecrypt(req.encrypted_phone).trim()
  const birthDate = safeDecrypt(req.encrypted_birth_date).trim()
  const noRm = fields.noRm.trim() || null

  const { error } = await createAdminClient()
    .from('patients')
    .update({
      encrypted_name:       encrypt(name),
      encrypted_phone:      encrypt(phone),
      encrypted_birth_date: birthDate ? encrypt(birthDate) : null,
      phone_hash:           phone ? await phoneHashIfFree(phone, req.web_patient_id) : null,
      name_normalized:      name.toLowerCase(),
      no_rm:                noRm,
      ...(fields.gender ? { gender: fields.gender } : {}),
      account_linked_at:    new Date().toISOString(),
      is_active:            true,
      updated_at:           new Date().toISOString(),
    })
    .eq('id', req.web_patient_id)
  if (error) {
    await release(id)
    return { error: error.code === '23505' && error.message.includes('no_rm') ? `No. RM "${noRm}" sudah dipakai pasien lain.` : error.message }
  }

  await logActivity({
    supabase: await createClient(), userId: reviewer.id, action: 'create', resourceType: 'patient',
    resourceId: req.web_patient_id, resourceLabel: name, branchId: req.branch_id,
    newValues: { source: 'account_link_request', request_id: id, no_rm: noRm },
  })
  return { error: null }
}

export async function rejectLinkRequest(id: string, note: string): Promise<{ error: string | null }> {
  const reviewer = await getReviewer()
  if (!reviewer) return { error: 'Tidak memiliki akses.' }
  if (!note.trim()) return { error: 'Alasan penolakan wajib diisi.' }
  const req = await loadScopedRequest(reviewer, id)
  if (!req) return { error: 'Permintaan tidak ditemukan.' }
  if (!(await claim(reviewer, id, { status: 'rejected', rejection_note: note.trim() }))) {
    return { error: 'Permintaan sudah diproses.' }
  }
  await logActivity({
    supabase: await createClient(), userId: reviewer.id, action: 'update', resourceType: 'account_link',
    resourceId: id, resourceLabel: safeDecrypt(req.encrypted_name), branchId: req.branch_id,
    newValues: { status: 'rejected', rejection_note: note.trim() },
  })
  return { error: null }
}
