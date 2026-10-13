'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/encryption'
import { logActivity } from '@/lib/activityLog'

// Affiliate sign-ups from gangsehat.com/daftar/afiliasi (gangsehat repo,
// supabase/migrations/046_affiliates.sql). A code only works on the patient
// form once the affiliate is 'approved'. Affiliates aren't branch-scoped, so
// review is director-only. PII is encrypted, so reads go through the service
// client after the role check.

const PAGE_SIZE = 10

export type AffiliateStatus = 'pending' | 'approved' | 'rejected' | 'inactive'

export interface AffiliateRow {
  id: string
  createdAt: string
  code: string
  name: string
  phone: string
  email: string | null
  domisili: string | null
  pekerjaan: string | null
  socialMedia: string | null
  bankName: string
  accountNumber: string
  accountHolder: string
  motivasi: string | null
  status: AffiliateStatus
  rejectionNote: string | null
  reviewedAt: string | null
  reviewerName: string | null
  /** Patient registrations submitted with this code. */
  referralCount: number
  /** …of which approved into patients. */
  referralApproved: number
  /** Sum of non-void entries in affiliate_points. */
  points: number
  /** Referred customers whose payment was confirmed (non-void referral awards). */
  paidCustomers: number
}

export interface AffiliateStats {
  total: number
  pending: number
  approved: number
  rejected: number
  inactive: number
  totalPoints: number
}

async function getDirector(): Promise<{ id: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: me } = await supabase
    .from('internal_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return me?.role === 'director' ? { id: user.id } : null
}

function safeDecrypt(v: string | null): string {
  if (!v) return ''
  try { return decrypt(v) } catch { return '' }
}

export async function fetchAffiliatesPage(params: {
  status: AffiliateStatus | 'all'
  search: string
  page: number
}): Promise<{ error: string | null; rows: AffiliateRow[]; total: number; stats: AffiliateStats }> {
  const empty = { rows: [], total: 0, stats: { total: 0, pending: 0, approved: 0, rejected: 0, inactive: 0, totalPoints: 0 } }
  const director = await getDirector()
  if (!director) return { ...empty, error: 'Tidak memiliki akses.' }

  const admin = createAdminClient()
  const countFor = async (status?: AffiliateStatus) => {
    let q = admin.from('affiliates').select('id', { count: 'exact', head: true })
    if (status) q = q.eq('status', status)
    const { count } = await q
    return count ?? 0
  }

  let query = admin
    .from('affiliates')
    .select('*, internal_profiles!reviewed_by(full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
  if (params.status !== 'all') query = query.eq('status', params.status)

  // Name/phone are encrypted, so a search decrypts the filtered set and
  // paginates in memory; the code is plain text and matched the same way.
  const term = params.search.trim().toLowerCase()
  const from = (params.page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  if (!term) query = query.range(from, to)
  else query = query.limit(1000)

  const [{ data, count, error }, total, pending, approved, rejected, inactive, allPoints] = await Promise.all([
    query,
    countFor(),
    countFor('pending'),
    countFor('approved'),
    countFor('rejected'),
    countFor('inactive'),
    admin.from('affiliate_points').select('points').eq('is_void', false),
  ])
  if (error) return { ...empty, error: error.message }

  let rows: AffiliateRow[] = (data ?? []).map((a) => ({
    id: a.id,
    createdAt: a.created_at,
    code: a.code,
    name: safeDecrypt(a.encrypted_name),
    phone: safeDecrypt(a.encrypted_phone),
    email: a.email,
    domisili: a.domisili,
    pekerjaan: a.pekerjaan,
    socialMedia: a.social_media,
    bankName: a.bank_name,
    accountNumber: safeDecrypt(a.encrypted_account_number),
    accountHolder: a.account_holder,
    motivasi: a.motivasi,
    status: a.status,
    rejectionNote: a.rejection_note,
    reviewedAt: a.reviewed_at,
    reviewerName: a.internal_profiles?.full_name ?? null,
    referralCount: 0,
    referralApproved: 0,
    points: 0,
    paidCustomers: 0,
  }))

  let filteredTotal = count ?? 0
  if (term) {
    rows = rows.filter((r) =>
      r.code.toLowerCase().includes(term) ||
      r.name.toLowerCase().includes(term) ||
      r.phone.includes(term) ||
      (r.domisili ?? '').toLowerCase().includes(term),
    )
    filteredTotal = rows.length
    rows = rows.slice(from, to + 1)
  }

  if (rows.length > 0) {
    const { data: refs } = await admin
      .from('patient_registrations')
      .select('affiliate_id, status')
      .in('affiliate_id', rows.map((r) => r.id))
    const byId = new Map(rows.map((r) => [r.id, r]))
    for (const ref of refs ?? []) {
      const r = byId.get(ref.affiliate_id)
      if (!r) continue
      r.referralCount++
      if (ref.status === 'approved') r.referralApproved++
    }

    const { data: pts } = await admin
      .from('affiliate_points')
      .select('affiliate_id, kind, points')
      .eq('is_void', false)
      .in('affiliate_id', rows.map((r) => r.id))
    for (const p of pts ?? []) {
      const r = byId.get(p.affiliate_id)
      if (!r) continue
      r.points += p.points
      if (p.kind === 'referral') r.paidCustomers++
    }
  }

  const totalPoints = (allPoints.data ?? []).reduce((sum, p) => sum + p.points, 0)
  return { error: null, rows, total: filteredTotal, stats: { total, pending, approved, rejected, inactive, totalPoints } }
}

/** Valid transitions: pending → approved/rejected, approved ↔ inactive. */
const ALLOWED_FROM: Record<Exclude<AffiliateStatus, 'pending'>, AffiliateStatus[]> = {
  approved: ['pending', 'inactive'],
  rejected: ['pending'],
  inactive: ['approved'],
}

export async function setAffiliateStatus(
  id: string,
  status: Exclude<AffiliateStatus, 'pending'>,
  note?: string,
): Promise<{ error: string | null }> {
  const director = await getDirector()
  if (!director) return { error: 'Tidak memiliki akses.' }
  if (status === 'rejected' && !note?.trim()) return { error: 'Alasan penolakan wajib diisi.' }

  const admin = createAdminClient()
  const { data: before } = await admin.from('affiliates').select('status, code').eq('id', id).maybeSingle()
  if (!before) return { error: 'Afiliasi tidak ditemukan.' }

  const { data, error } = await admin
    .from('affiliates')
    .update({
      status,
      rejection_note: status === 'rejected' ? note!.trim() : null,
      reviewed_by: director.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .in('status', ALLOWED_FROM[status])
    .select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Status afiliasi sudah berubah. Muat ulang halaman.' }

  await logActivity({
    supabase: await createClient(), userId: director.id, action: 'update', resourceType: 'affiliate',
    resourceId: id, resourceLabel: before.code,
    oldValues: { status: before.status },
    newValues: { status, ...(status === 'rejected' ? { rejection_note: note!.trim() } : {}) },
  })
  return { error: null }
}

export async function deleteAffiliate(id: string): Promise<{ error: string | null }> {
  const director = await getDirector()
  if (!director) return { error: 'Tidak memiliki akses.' }

  const admin = createAdminClient()
  const { data: before } = await admin.from('affiliates').select('code, status').eq('id', id).maybeSingle()
  if (!before) return { error: 'Afiliasi tidak ditemukan.' }
  // Registrations keep affiliate_code; affiliate_id is set null by the FK.
  const { error } = await admin.from('affiliates').delete().eq('id', id)
  if (error) return { error: error.message }

  await logActivity({
    supabase: await createClient(), userId: director.id, action: 'delete', resourceType: 'affiliate',
    resourceId: id, resourceLabel: before.code, oldValues: { code: before.code, status: before.status },
  })
  return { error: null }
}

// ── Points ──────────────────────────────────────────────────────────────────
// Referral awards are written by the DB (supabase/104-affiliate-points.sql) when
// a referred patient's first income transaction is confirmed, at the rate in
// affiliate_settings. Directors adjust here; every change is logged.

export interface AffiliatePointEntry {
  id: string
  createdAt: string
  kind: 'referral' | 'adjustment'
  points: number
  /** Rate at award time (referral only). */
  defaultPoints: number | null
  note: string | null
  isVoid: boolean
  patientName: string | null
  patientNoRm: string | null
  transactionDate: string | null
  transactionAmount: number | null
  createdByName: string | null
  editedByName: string | null
  editedAt: string | null
}

export async function getAffiliatePointsRate(): Promise<{ error: string | null; rate: number }> {
  const director = await getDirector()
  if (!director) return { error: 'Tidak memiliki akses.', rate: 0 }
  const { data, error } = await createAdminClient()
    .from('affiliate_settings').select('points_per_customer').eq('id', true).maybeSingle()
  if (error) return { error: error.message, rate: 0 }
  return { error: null, rate: data?.points_per_customer ?? 10 }
}

export async function setAffiliatePointsRate(rate: number): Promise<{ error: string | null }> {
  const director = await getDirector()
  if (!director) return { error: 'Tidak memiliki akses.' }
  if (!Number.isInteger(rate) || rate < 0) return { error: 'Poin harus bilangan bulat ≥ 0.' }

  const admin = createAdminClient()
  const { data: before } = await admin
    .from('affiliate_settings').select('points_per_customer').eq('id', true).maybeSingle()
  const { error } = await admin.from('affiliate_settings').upsert({
    id: true, points_per_customer: rate, updated_by: director.id, updated_at: new Date().toISOString(),
  })
  if (error) return { error: error.message }

  await logActivity({
    supabase: await createClient(), userId: director.id, action: 'update', resourceType: 'affiliate_points',
    resourceLabel: 'Poin per pelanggan',
    oldValues: { points_per_customer: before?.points_per_customer ?? null },
    newValues: { points_per_customer: rate },
  })
  return { error: null }
}

export async function fetchAffiliatePoints(
  affiliateId: string,
): Promise<{ error: string | null; entries: AffiliatePointEntry[] }> {
  const director = await getDirector()
  if (!director) return { error: 'Tidak memiliki akses.', entries: [] }

  const { data, error } = await createAdminClient()
    .from('affiliate_points')
    .select(`
      id, created_at, kind, points, default_points, note, is_void, edited_at,
      patients!patient_id(encrypted_name, no_rm),
      transactions!transaction_id(transaction_date, amount),
      creator:internal_profiles!created_by(full_name),
      editor:internal_profiles!edited_by(full_name)
    `)
    .eq('affiliate_id', affiliateId)
    .order('created_at', { ascending: false })
  if (error) return { error: error.message, entries: [] }

  type One<T> = T | T[] | null
  const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v)

  const entries: AffiliatePointEntry[] = (data ?? []).map((e) => {
    const patient = one(e.patients as One<{ encrypted_name: string; no_rm: string | null }>)
    const tx = one(e.transactions as One<{ transaction_date: string; amount: number }>)
    return {
      id: e.id,
      createdAt: e.created_at,
      kind: e.kind,
      points: e.points,
      defaultPoints: e.default_points,
      note: e.note,
      isVoid: e.is_void,
      patientName: patient ? safeDecrypt(patient.encrypted_name) || null : null,
      patientNoRm: patient?.no_rm ?? null,
      transactionDate: tx?.transaction_date ?? null,
      transactionAmount: tx?.amount ?? null,
      createdByName: one(e.creator as One<{ full_name: string }>)?.full_name ?? null,
      editedByName: one(e.editor as One<{ full_name: string }>)?.full_name ?? null,
      editedAt: e.edited_at,
    }
  })
  return { error: null, entries }
}

async function loadEntry(id: string) {
  const { data } = await createAdminClient()
    .from('affiliate_points')
    .select('id, affiliate_id, kind, points, default_points, note, is_void, affiliates!affiliate_id(code)')
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  const aff = data.affiliates as { code: string } | { code: string }[] | null
  return { ...data, code: (Array.isArray(aff) ? aff[0]?.code : aff?.code) ?? '' }
}

export async function updateAffiliatePointEntry(
  id: string,
  points: number,
  note: string,
): Promise<{ error: string | null }> {
  const director = await getDirector()
  if (!director) return { error: 'Tidak memiliki akses.' }
  if (!Number.isInteger(points)) return { error: 'Poin harus bilangan bulat.' }

  const before = await loadEntry(id)
  if (!before) return { error: 'Data poin tidak ditemukan.' }
  const cleanNote = note.trim()
  if (before.kind === 'referral' && points < 0) return { error: 'Poin rujukan tidak boleh negatif.' }
  if (before.kind === 'adjustment' && points === 0) return { error: 'Poin penyesuaian tidak boleh 0.' }
  if (!cleanNote && (before.kind === 'adjustment' || points !== before.default_points)) {
    return { error: 'Catatan wajib diisi saat mengubah poin.' }
  }

  const { error } = await createAdminClient()
    .from('affiliate_points')
    .update({ points, note: cleanNote || null, edited_by: director.id, edited_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }

  await logActivity({
    supabase: await createClient(), userId: director.id, action: 'update', resourceType: 'affiliate_points',
    resourceId: id, resourceLabel: before.code,
    oldValues: { points: before.points, note: before.note },
    newValues: { points, note: cleanNote || null },
  })
  return { error: null }
}

export async function setAffiliatePointVoid(id: string, isVoid: boolean): Promise<{ error: string | null }> {
  const director = await getDirector()
  if (!director) return { error: 'Tidak memiliki akses.' }

  const before = await loadEntry(id)
  if (!before) return { error: 'Data poin tidak ditemukan.' }

  const { error } = await createAdminClient()
    .from('affiliate_points')
    .update({ is_void: isVoid, edited_by: director.id, edited_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }

  await logActivity({
    supabase: await createClient(), userId: director.id, action: 'update', resourceType: 'affiliate_points',
    resourceId: id, resourceLabel: before.code,
    oldValues: { is_void: before.is_void }, newValues: { is_void: isVoid },
  })
  return { error: null }
}

export async function addAffiliateAdjustment(
  affiliateId: string,
  points: number,
  note: string,
): Promise<{ error: string | null }> {
  const director = await getDirector()
  if (!director) return { error: 'Tidak memiliki akses.' }
  if (!Number.isInteger(points) || points === 0) return { error: 'Poin harus bilangan bulat selain 0.' }
  if (!note.trim()) return { error: 'Catatan wajib diisi.' }

  const admin = createAdminClient()
  const { data: aff } = await admin.from('affiliates').select('code').eq('id', affiliateId).maybeSingle()
  if (!aff) return { error: 'Afiliasi tidak ditemukan.' }

  const { data, error } = await admin
    .from('affiliate_points')
    .insert({ affiliate_id: affiliateId, kind: 'adjustment', points, note: note.trim(), created_by: director.id })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await logActivity({
    supabase: await createClient(), userId: director.id, action: 'create', resourceType: 'affiliate_points',
    resourceId: data.id, resourceLabel: aff.code, newValues: { points, note: note.trim() },
  })
  return { error: null }
}
