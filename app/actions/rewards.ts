'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/encryption'
import { logActivity } from '@/lib/activityLog'

// Patient reward points (supabase/108-patient-referral-rewards.sql).
// Patients earn points when someone registers with their referral code on
// gangsehat.com/daftar and that patient's first payment is confirmed (DB
// trigger). Staff redeem points for reward_items here. Redeem/cancel go
// through SECURITY DEFINER RPCs with the user's session so the balance check
// and stock update are atomic; everything else reads via the service client
// after the role check (names are encrypted).
//
// Reward points are NOT session credits (patient_points, gangsehat repo).

const PAGE_SIZE = 15
const STAFF_ROLES = ['director', 'manager', 'admin', 'marketing'] as const

type StaffRole = (typeof STAFF_ROLES)[number]
type One<T> = T | T[] | null
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v)

async function getStaff(): Promise<{ id: string; role: StaffRole } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: me } = await supabase
    .from('internal_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return me && (STAFF_ROLES as readonly string[]).includes(me.role)
    ? { id: user.id, role: me.role as StaffRole }
    : null
}

function safeDecrypt(v: string | null): string {
  if (!v) return ''
  try { return decrypt(v) } catch { return '' }
}

/** RPC errors carry the Indonesian message raised in SQL. */
function rpcMessage(message: string) {
  return message.replace(/^.*?ERROR:\s*/, '')
}

// ── Balances ────────────────────────────────────────────────────────────────

export interface RewardBalanceRow {
  patientId: string
  name: string
  noRm: string | null
  referralCode: string | null
  earned: number
  spent: number
  balance: number
  referralCount: number
}

export interface RewardStats {
  outstanding: number
  patientsWithPoints: number
  redemptionsThisMonth: number
  pointsRedeemedThisMonth: number
}

async function loadAllBalances(): Promise<{ error: string | null; rows: RewardBalanceRow[] }> {
  const admin = createAdminClient()
  const { data: balances, error } = await admin
    .from('reward_point_balances')
    .select('patient_id, earned, spent, balance, referral_count')
    .order('balance', { ascending: false })
    .limit(5000)
  if (error) return { error: error.message, rows: [] }
  if (!balances?.length) return { error: null, rows: [] }

  const ids = balances.map((b) => b.patient_id)
  const patients = new Map<string, { encrypted_name: string; no_rm: string | null; referral_code: string | null }>()
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await admin
      .from('patients')
      .select('id, encrypted_name, no_rm, referral_code')
      .in('id', ids.slice(i, i + 500))
    for (const p of data ?? []) patients.set(p.id, p)
  }

  return {
    error: null,
    rows: balances.map((b) => {
      const p = patients.get(b.patient_id)
      return {
        patientId: b.patient_id,
        name: safeDecrypt(p?.encrypted_name ?? null) || 'Pasien terhapus',
        noRm: p?.no_rm ?? null,
        referralCode: p?.referral_code ?? null,
        earned: b.earned,
        spent: b.spent,
        balance: b.balance,
        referralCount: b.referral_count,
      }
    }),
  }
}

export async function fetchRewardBalances(params: {
  search: string
  page: number
  onlyWithPoints: boolean
}): Promise<{ error: string | null; rows: RewardBalanceRow[]; total: number; stats: RewardStats }> {
  const emptyStats = { outstanding: 0, patientsWithPoints: 0, redemptionsThisMonth: 0, pointsRedeemedThisMonth: 0 }
  const staff = await getStaff()
  if (!staff) return { error: 'Tidak memiliki akses.', rows: [], total: 0, stats: emptyStats }

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [all, { data: monthRedemptions }] = await Promise.all([
    loadAllBalances(),
    createAdminClient()
      .from('reward_redemptions')
      .select('total_points')
      .eq('status', 'completed')
      .gte('created_at', monthStart.toISOString()),
  ])
  if (all.error) return { error: all.error, rows: [], total: 0, stats: emptyStats }

  const stats: RewardStats = {
    outstanding: all.rows.reduce((sum, r) => sum + Math.max(r.balance, 0), 0),
    patientsWithPoints: all.rows.filter((r) => r.balance > 0).length,
    redemptionsThisMonth: monthRedemptions?.length ?? 0,
    pointsRedeemedThisMonth: (monthRedemptions ?? []).reduce((sum, r) => sum + r.total_points, 0),
  }

  // Names are encrypted → filter in memory (the set is only patients with a ledger).
  const term = params.search.trim().toLowerCase()
  let rows = params.onlyWithPoints ? all.rows.filter((r) => r.balance > 0) : all.rows
  if (term) {
    rows = rows.filter((r) =>
      r.name.toLowerCase().includes(term) ||
      (r.noRm ?? '').toLowerCase().includes(term) ||
      (r.referralCode ?? '').toLowerCase().includes(term),
    )
  }
  const from = (params.page - 1) * PAGE_SIZE
  return { error: null, rows: rows.slice(from, from + PAGE_SIZE), total: rows.length, stats }
}

/** Patients who can redeem something right now (balance > 0), for the picker. */
export async function fetchRedeemablePatients(): Promise<{ error: string | null; rows: RewardBalanceRow[] }> {
  const staff = await getStaff()
  if (!staff) return { error: 'Tidak memiliki akses.', rows: [] }
  const all = await loadAllBalances()
  if (all.error) return all
  return {
    error: null,
    rows: all.rows.filter((r) => r.balance > 0).sort((a, b) => a.name.localeCompare(b.name, 'id')),
  }
}

// ── Ledger ──────────────────────────────────────────────────────────────────

export interface RewardLedgerEntry {
  id: string
  createdAt: string
  kind: 'referral' | 'redemption' | 'adjustment'
  points: number
  note: string | null
  isVoid: boolean
  referredName: string | null
  referredNoRm: string | null
  createdByName: string | null
}

export async function fetchPatientRewardLedger(
  patientId: string,
): Promise<{ error: string | null; entries: RewardLedgerEntry[] }> {
  const staff = await getStaff()
  if (!staff) return { error: 'Tidak memiliki akses.', entries: [] }

  const { data, error } = await createAdminClient()
    .from('reward_points')
    .select(`
      id, created_at, kind, points, note, is_void,
      referred:patients!referred_patient_id(encrypted_name, no_rm),
      creator:internal_profiles!created_by(full_name)
    `)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) return { error: error.message, entries: [] }

  return {
    error: null,
    entries: (data ?? []).map((e) => {
      const referred = one(e.referred as One<{ encrypted_name: string; no_rm: string | null }>)
      return {
        id: e.id,
        createdAt: e.created_at,
        kind: e.kind,
        points: e.points,
        note: e.note,
        isVoid: e.is_void,
        referredName: referred ? safeDecrypt(referred.encrypted_name) || null : null,
        referredNoRm: referred?.no_rm ?? null,
        createdByName: one(e.creator as One<{ full_name: string }>)?.full_name ?? null,
      }
    }),
  }
}

/** Director-only manual +/- (bonus, correction). */
export async function addRewardAdjustment(
  patientId: string,
  points: number,
  note: string,
): Promise<{ error: string | null }> {
  const staff = await getStaff()
  if (staff?.role !== 'director') return { error: 'Hanya direktur yang dapat menambah penyesuaian.' }
  if (!Number.isInteger(points) || points === 0) return { error: 'Poin harus bilangan bulat dan tidak 0.' }
  const cleanNote = note.trim()
  if (!cleanNote) return { error: 'Catatan wajib diisi.' }

  const admin = createAdminClient()
  if (points < 0) {
    const { data: bal } = await admin
      .from('reward_point_balances').select('balance').eq('patient_id', patientId).maybeSingle()
    if ((bal?.balance ?? 0) + points < 0) return { error: 'Saldo poin tidak boleh negatif.' }
  }

  const { data, error } = await admin
    .from('reward_points')
    .insert({ patient_id: patientId, kind: 'adjustment', points, note: cleanNote, created_by: staff.id })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await logActivity({
    supabase: await createClient(), userId: staff.id, action: 'create', resourceType: 'reward_points',
    resourceId: data.id, resourceLabel: 'Penyesuaian poin hadiah',
    newValues: { patient_id: patientId, points, note: cleanNote },
  })
  return { error: null }
}

// ── Settings ────────────────────────────────────────────────────────────────

export async function getRewardSettings(): Promise<{ error: string | null; pointsPerReferral: number; canEdit: boolean }> {
  const staff = await getStaff()
  if (!staff) return { error: 'Tidak memiliki akses.', pointsPerReferral: 0, canEdit: false }
  const { data, error } = await createAdminClient()
    .from('reward_settings').select('points_per_referral').eq('id', true).maybeSingle()
  if (error) return { error: error.message, pointsPerReferral: 0, canEdit: false }
  return { error: null, pointsPerReferral: data?.points_per_referral ?? 5, canEdit: staff.role === 'director' }
}

export async function setRewardSettings(pointsPerReferral: number): Promise<{ error: string | null }> {
  const staff = await getStaff()
  if (staff?.role !== 'director') return { error: 'Hanya direktur yang dapat mengubah poin per referral.' }
  if (!Number.isInteger(pointsPerReferral) || pointsPerReferral < 0) return { error: 'Poin harus bilangan bulat ≥ 0.' }

  const admin = createAdminClient()
  const { data: before } = await admin
    .from('reward_settings').select('points_per_referral').eq('id', true).maybeSingle()
  const { error } = await admin.from('reward_settings').upsert({
    id: true, points_per_referral: pointsPerReferral, updated_by: staff.id, updated_at: new Date().toISOString(),
  })
  if (error) return { error: error.message }

  await logActivity({
    supabase: await createClient(), userId: staff.id, action: 'update', resourceType: 'reward_points',
    resourceLabel: 'Poin per referral',
    oldValues: { points_per_referral: before?.points_per_referral ?? null },
    newValues: { points_per_referral: pointsPerReferral },
  })
  return { error: null }
}

// ── Catalog ─────────────────────────────────────────────────────────────────

export interface RewardItem {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  pointsCost: number
  stock: number | null
  isActive: boolean
  sortOrder: number
  redemptionCount: number
}

export interface RewardItemInput {
  name: string
  description: string
  imageUrl: string
  pointsCost: number
  /** null = unlimited */
  stock: number | null
  isActive: boolean
  sortOrder: number
}

export async function listRewardItems(
  opts: { activeOnly?: boolean } = {},
): Promise<{ error: string | null; items: RewardItem[] }> {
  const staff = await getStaff()
  if (!staff) return { error: 'Tidak memiliki akses.', items: [] }

  const admin = createAdminClient()
  let query = admin
    .from('reward_items')
    .select('id, name, description, image_url, points_cost, stock, is_active, sort_order')
    .order('sort_order')
    .order('points_cost')
  if (opts.activeOnly) query = query.eq('is_active', true)
  const [{ data, error }, { data: reds }] = await Promise.all([
    query,
    admin.from('reward_redemptions').select('reward_item_id').eq('status', 'completed'),
  ])
  if (error) return { error: error.message, items: [] }

  const counts = new Map<string, number>()
  for (const r of reds ?? []) if (r.reward_item_id) counts.set(r.reward_item_id, (counts.get(r.reward_item_id) ?? 0) + 1)

  return {
    error: null,
    items: (data ?? []).map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      imageUrl: i.image_url,
      pointsCost: i.points_cost,
      stock: i.stock,
      isActive: i.is_active,
      sortOrder: i.sort_order,
      redemptionCount: counts.get(i.id) ?? 0,
    })),
  }
}

function validateItem(input: RewardItemInput): string | null {
  if (!input.name.trim()) return 'Nama hadiah wajib diisi.'
  if (!Number.isInteger(input.pointsCost) || input.pointsCost <= 0) return 'Harga poin harus bilangan bulat > 0.'
  if (input.stock !== null && (!Number.isInteger(input.stock) || input.stock < 0)) return 'Stok harus bilangan bulat ≥ 0 atau kosong.'
  if (!Number.isInteger(input.sortOrder)) return 'Urutan harus bilangan bulat.'
  if (input.imageUrl.trim() && !/^https?:\/\//i.test(input.imageUrl.trim())) return 'URL gambar harus diawali http:// atau https://'
  return null
}

export async function upsertRewardItem(
  id: string | null,
  input: RewardItemInput,
): Promise<{ error: string | null }> {
  const staff = await getStaff()
  if (!staff) return { error: 'Tidak memiliki akses.' }
  const invalid = validateItem(input)
  if (invalid) return { error: invalid }

  const row = {
    name: input.name.trim(),
    description: input.description.trim() || null,
    image_url: input.imageUrl.trim() || null,
    points_cost: input.pointsCost,
    stock: input.stock,
    is_active: input.isActive,
    sort_order: input.sortOrder,
    updated_by: staff.id,
    updated_at: new Date().toISOString(),
  }

  const admin = createAdminClient()
  if (id) {
    const { data: before } = await admin.from('reward_items').select('*').eq('id', id).maybeSingle()
    if (!before) return { error: 'Hadiah tidak ditemukan.' }
    const { error } = await admin.from('reward_items').update(row).eq('id', id)
    if (error) return { error: error.message }
    await logActivity({
      supabase: await createClient(), userId: staff.id, action: 'update', resourceType: 'reward_item',
      resourceId: id, resourceLabel: row.name,
      oldValues: { name: before.name, points_cost: before.points_cost, stock: before.stock, is_active: before.is_active },
      newValues: { name: row.name, points_cost: row.points_cost, stock: row.stock, is_active: row.is_active },
    })
  } else {
    const { data, error } = await admin
      .from('reward_items')
      .insert({ ...row, created_by: staff.id })
      .select('id')
      .single()
    if (error) return { error: error.message }
    await logActivity({
      supabase: await createClient(), userId: staff.id, action: 'create', resourceType: 'reward_item',
      resourceId: data.id, resourceLabel: row.name,
      newValues: { name: row.name, points_cost: row.points_cost, stock: row.stock },
    })
  }
  return { error: null }
}

export async function setRewardItemActive(id: string, isActive: boolean): Promise<{ error: string | null }> {
  const staff = await getStaff()
  if (!staff) return { error: 'Tidak memiliki akses.' }
  const admin = createAdminClient()
  const { data: before } = await admin.from('reward_items').select('name, is_active').eq('id', id).maybeSingle()
  if (!before) return { error: 'Hadiah tidak ditemukan.' }
  const { error } = await admin
    .from('reward_items')
    .update({ is_active: isActive, updated_by: staff.id, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  await logActivity({
    supabase: await createClient(), userId: staff.id, action: 'update', resourceType: 'reward_item',
    resourceId: id, resourceLabel: before.name,
    oldValues: { is_active: before.is_active }, newValues: { is_active: isActive },
  })
  return { error: null }
}

/** Items with redemption history are kept (deactivate instead) so history stays readable. */
export async function deleteRewardItem(id: string): Promise<{ error: string | null }> {
  const staff = await getStaff()
  if (!staff) return { error: 'Tidak memiliki akses.' }
  const admin = createAdminClient()
  const { data: before } = await admin.from('reward_items').select('name').eq('id', id).maybeSingle()
  if (!before) return { error: 'Hadiah tidak ditemukan.' }
  const { count } = await admin
    .from('reward_redemptions').select('id', { count: 'exact', head: true }).eq('reward_item_id', id)
  if ((count ?? 0) > 0) return { error: 'Hadiah sudah pernah ditukar. Nonaktifkan saja agar riwayat tetap tersimpan.' }

  const { error } = await admin.from('reward_items').delete().eq('id', id)
  if (error) return { error: error.message }
  await logActivity({
    supabase: await createClient(), userId: staff.id, action: 'delete', resourceType: 'reward_item',
    resourceId: id, resourceLabel: before.name, oldValues: { name: before.name },
  })
  return { error: null }
}

// ── Redemptions ─────────────────────────────────────────────────────────────

export interface RewardRedemptionRow {
  id: string
  createdAt: string
  patientId: string
  patientName: string
  patientNoRm: string | null
  itemName: string
  quantity: number
  totalPoints: number
  status: 'completed' | 'cancelled'
  note: string | null
  branchName: string | null
  redeemedByName: string | null
  cancelledByName: string | null
  cancelledAt: string | null
}

export async function fetchRedemptions(params: {
  page: number
  patientId?: string | null
}): Promise<{ error: string | null; rows: RewardRedemptionRow[]; total: number }> {
  const staff = await getStaff()
  if (!staff) return { error: 'Tidak memiliki akses.', rows: [], total: 0 }

  const from = (params.page - 1) * PAGE_SIZE
  let query = createAdminClient()
    .from('reward_redemptions')
    .select(`
      id, created_at, patient_id, item_name, quantity, total_points, status, note, cancelled_at,
      patient:patients!patient_id(encrypted_name, no_rm),
      branch:branches!branch_id(name),
      redeemer:internal_profiles!redeemed_by(full_name),
      canceller:internal_profiles!cancelled_by(full_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
  if (params.patientId) query = query.eq('patient_id', params.patientId)

  const { data, count, error } = await query
  if (error) return { error: error.message, rows: [], total: 0 }

  return {
    error: null,
    total: count ?? 0,
    rows: (data ?? []).map((r) => {
      const patient = one(r.patient as One<{ encrypted_name: string; no_rm: string | null }>)
      return {
        id: r.id,
        createdAt: r.created_at,
        patientId: r.patient_id,
        patientName: patient ? safeDecrypt(patient.encrypted_name) || 'Pasien' : 'Pasien terhapus',
        patientNoRm: patient?.no_rm ?? null,
        itemName: r.item_name,
        quantity: r.quantity,
        totalPoints: r.total_points,
        status: r.status,
        note: r.note,
        branchName: one(r.branch as One<{ name: string }>)?.name ?? null,
        redeemedByName: one(r.redeemer as One<{ full_name: string }>)?.full_name ?? null,
        cancelledByName: one(r.canceller as One<{ full_name: string }>)?.full_name ?? null,
        cancelledAt: r.cancelled_at,
      }
    }),
  }
}

export async function redeemReward(params: {
  patientId: string
  itemId: string
  quantity: number
  note: string
}): Promise<{ error: string | null }> {
  const staff = await getStaff()
  if (!staff) return { error: 'Tidak memiliki akses.' }
  if (!Number.isInteger(params.quantity) || params.quantity < 1) return { error: 'Jumlah minimal 1.' }

  // User-session client: the RPC checks get_my_internal_role() itself.
  const supabase = await createClient()
  const { data: id, error } = await supabase.rpc('redeem_reward', {
    p_patient: params.patientId,
    p_item: params.itemId,
    p_quantity: params.quantity,
    p_note: params.note.trim() || null,
  })
  if (error) return { error: rpcMessage(error.message) }

  await logActivity({
    supabase, userId: staff.id, action: 'create', resourceType: 'reward_redemption',
    resourceId: id as string, resourceLabel: 'Penukaran hadiah',
    newValues: { patient_id: params.patientId, reward_item_id: params.itemId, quantity: params.quantity },
  })
  return { error: null }
}

export async function cancelRedemption(id: string): Promise<{ error: string | null }> {
  const staff = await getStaff()
  if (!staff) return { error: 'Tidak memiliki akses.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_redemption', { p_redemption: id })
  if (error) return { error: rpcMessage(error.message) }

  await logActivity({
    supabase, userId: staff.id, action: 'update', resourceType: 'reward_redemption',
    resourceId: id, resourceLabel: 'Penukaran hadiah',
    oldValues: { status: 'completed' }, newValues: { status: 'cancelled' },
  })
  return { error: null }
}
