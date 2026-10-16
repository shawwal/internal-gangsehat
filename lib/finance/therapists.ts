import type { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { byDateDesc, selectAttributedTransactions } from './attribution'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export interface TherapistSourceRow {
  id: string
  fisio_id: string | null
  visit_id: string | null
}

export interface TherapistRef {
  id: string
  name: string
}

/**
 * Therapist per transaction id: `fisio_id`, falling back to the linked
 * visit's `attending_staff_id`. `rows` must already be RLS-scoped (read with
 * the caller's client); only profile names go through the admin client,
 * since finance/admin can't SELECT other staff rows.
 *
 * Same attribution rule as `loadTherapistTransactions` — keep them in sync.
 */
export async function resolveTherapistNames(
  supabase: ServerClient,
  rows: TherapistSourceRow[],
): Promise<Map<string, TherapistRef>> {
  const result = new Map<string, TherapistRef>()
  if (!rows.length) return result

  const staffByTx = await resolveTherapistIds(supabase, rows)
  const staffIds = [...new Set(staffByTx.values())]
  if (!staffIds.length) return result

  const { data: profiles } = await createAdminClient()
    .from('internal_profiles')
    .select('id, full_name')
    .in('id', staffIds)
  const nameById = new Map((profiles ?? []).map((p) => [p.id as string, p.full_name as string]))

  for (const [txId, staffId] of staffByTx) {
    const name = nameById.get(staffId)
    if (name) result.set(txId, { id: staffId, name })
  }
  return result
}

/**
 * The attribution rule itself — therapist id per transaction id: `fisio_id`,
 * else the linked visit's `attending_staff_id`; unattributed rows are absent.
 * Shared by the finance tables (via `resolveTherapistNames`) and PFOTM, so a
 * therapist's PFOTM sales are exactly their rows on the finance page.
 */
export async function resolveTherapistIds(
  supabase: { from: ServerClient['from'] },
  rows: TherapistSourceRow[],
): Promise<Map<string, string>> {
  const visitIds = [...new Set(rows.filter((r) => !r.fisio_id && r.visit_id).map((r) => r.visit_id as string))]
  const visitStaff = new Map<string, string>()
  for (let i = 0; i < visitIds.length; i += 300) {
    const { data: visits } = await supabase
      .from('patient_visits')
      .select('id, attending_staff_id')
      .in('id', visitIds.slice(i, i + 300))
    for (const v of visits ?? []) if (v.attending_staff_id) visitStaff.set(v.id, v.attending_staff_id)
  }

  const staffByTx = new Map<string, string>()
  for (const r of rows) {
    const staffId = r.fisio_id ?? (r.visit_id ? visitStaff.get(r.visit_id) : undefined)
    if (staffId) staffByTx.set(r.id, staffId)
  }
  return staffByTx
}

const THERAPIST_TX_COLUMNS =
  'id, branch_id, patient_id, visit_id, type, category, harga, discount, amount, outstanding, payment_method, payment_status, status, transaction_date, description, branches!branch_id(name)'

export interface TherapistTransaction {
  id: string
  branch_id: string
  patient_id: string | null
  visit_id: string | null
  type: string
  category: string
  harga: number | null
  discount: number | null
  amount: number | null
  outstanding: number | null
  payment_method: string | null
  payment_status: string | null
  status: string
  transaction_date: string
  description: string | null
  branch_name: string
}

/**
 * Every non-rejected transaction attributed to `staffId` (same rule as
 * `resolveTherapistNames`), newest first. `from`/`to` are inclusive
 * YYYY-MM-DD; empty = unbounded. Read with the caller's client, so RLS keeps
 * non-directors to their own branch.
 */
export async function loadTherapistTransactions(
  supabase: ServerClient,
  staffId: string,
  { from, to, branchId }: { from: string; to: string; branchId?: string },
): Promise<TherapistTransaction[]> {
  type Raw = Omit<TherapistTransaction, 'branch_name'> & { branches: unknown }
  const raw = await selectAttributedTransactions<Raw>(supabase, THERAPIST_TX_COLUMNS, staffId, (q) => {
    q = q.neq('status', 'rejected').limit(99999)
    if (from)     q = q.gte('transaction_date', from)
    if (to)       q = q.lte('transaction_date', to)
    if (branchId) q = q.eq('branch_id', branchId)
    return q
  })
  return raw
    .map(({ branches, ...rest }) => ({ ...rest, branch_name: (branches as { name: string } | null)?.name ?? '—' }))
    .sort(byDateDesc)
}

export interface TherapistOption {
  id: string
  name: string
  inactive: boolean
}

const THERAPIST_ROLES = ['therapist', 'sport_massage_therapist']

/**
 * Options for the therapist filter: therapist-role staff of the branch (all
 * branches when `branchId` is empty) plus anyone recently recorded as the
 * therapist on a visible transaction — admins/managers do treat patients.
 * `branchId` must already be forced to the caller's own branch for
 * non-directors; the transaction scan is RLS-scoped via the caller's client.
 */
export async function listTherapistOptions(supabase: ServerClient, branchId: string): Promise<TherapistOption[]> {
  const admin = createAdminClient()
  let rolesQ = admin.from('internal_profiles').select('id').in('role', THERAPIST_ROLES)
  if (branchId) rolesQ = rolesQ.eq('branch_id', branchId)
  let recentQ = supabase
    .from('transactions')
    .select('fisio_id')
    .not('fisio_id', 'is', null)
    .order('transaction_date', { ascending: false })
    .limit(1000)
  if (branchId) recentQ = recentQ.eq('branch_id', branchId)

  const [{ data: byRole }, { data: recent }] = await Promise.all([rolesQ, recentQ])
  const ids = [...new Set([
    ...(byRole ?? []).map((p) => p.id as string),
    ...(recent ?? []).map((r) => r.fisio_id as string),
  ])]
  if (!ids.length) return []

  const { data: profiles } = await admin.from('internal_profiles').select('id, full_name, is_active').in('id', ids)
  return (profiles ?? [])
    .map((p) => ({ id: p.id as string, name: (p.full_name as string) || '—', inactive: p.is_active === false }))
    .sort((a, b) => Number(a.inactive) - Number(b.inactive) || a.name.localeCompare(b.name, 'id'))
}

/** Therapist profile for the page header (admin client — see above). */
export async function getTherapistProfile(staffId: string) {
  const { data } = await createAdminClient()
    .from('internal_profiles')
    .select('id, full_name, role, branches!branch_id(name)')
    .eq('id', staffId)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id as string,
    name: data.full_name as string,
    role: data.role as string,
    branchName: (data.branches as unknown as { name: string } | null)?.name ?? null,
  }
}
