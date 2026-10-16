import type { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  const visitIds = [...new Set(rows.filter((r) => !r.fisio_id && r.visit_id).map((r) => r.visit_id as string))]
  const visitStaff = new Map<string, string>()
  if (visitIds.length) {
    const { data: visits } = await supabase
      .from('patient_visits')
      .select('id, attending_staff_id')
      .in('id', visitIds)
    for (const v of visits ?? []) if (v.attending_staff_id) visitStaff.set(v.id, v.attending_staff_id)
  }

  const staffByTx = new Map<string, string>()
  for (const r of rows) {
    const staffId = r.fisio_id ?? (r.visit_id ? visitStaff.get(r.visit_id) : undefined)
    if (staffId) staffByTx.set(r.id, staffId)
  }
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
  // fisio_id set → it decides; otherwise the visit's attending staff does.
  let direct = supabase
    .from('transactions')
    .select(THERAPIST_TX_COLUMNS)
    .eq('fisio_id', staffId)
    .neq('status', 'rejected')
    .limit(99999)
  let viaVisit = supabase
    .from('transactions')
    .select(`${THERAPIST_TX_COLUMNS}, patient_visits!visit_id!inner(attending_staff_id)`)
    .is('fisio_id', null)
    .eq('patient_visits.attending_staff_id', staffId)
    .neq('status', 'rejected')
    .limit(99999)
  if (from) { direct = direct.gte('transaction_date', from); viaVisit = viaVisit.gte('transaction_date', from) }
  if (to)   { direct = direct.lte('transaction_date', to);   viaVisit = viaVisit.lte('transaction_date', to) }
  if (branchId) { direct = direct.eq('branch_id', branchId); viaVisit = viaVisit.eq('branch_id', branchId) }

  const [a, b] = await Promise.all([direct, viaVisit])
  type Raw = Omit<TherapistTransaction, 'branch_name'> & { branches: unknown; patient_visits?: unknown }
  const rows: TherapistTransaction[] = ([...(a.data ?? []), ...(b.data ?? [])] as unknown as Raw[]).map((r) => {
    const { branches, ...rest } = r
    delete rest.patient_visits
    return { ...rest, branch_name: (branches as { name: string } | null)?.name ?? '—' }
  })
  return rows.sort((x, y) =>
    y.transaction_date.localeCompare(x.transaction_date) || y.id.localeCompare(x.id))
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
