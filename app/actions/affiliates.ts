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
}

export interface AffiliateStats {
  total: number
  pending: number
  approved: number
  rejected: number
  inactive: number
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
  const empty = { rows: [], total: 0, stats: { total: 0, pending: 0, approved: 0, rejected: 0, inactive: 0 } }
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

  const [{ data, count, error }, total, pending, approved, rejected, inactive] = await Promise.all([
    query,
    countFor(),
    countFor('pending'),
    countFor('approved'),
    countFor('rejected'),
    countFor('inactive'),
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
  }

  return { error: null, rows, total: filteredTotal, stats: { total, pending, approved, rejected, inactive } }
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
