// Client-safe (browser or server Supabase client). Server-only name lookups
// live in lib/finance/therapists.ts.

/** Income categories offered as the "layanan" (service) filter. */
export const SERVICE_CATEGORIES = [
  'TA KLINIK',
  'SESI KLINIK',
  'PAKET KLINIK',
  'TA VISIT',
  'SESI VISIT',
  'PAKET VISIT',
  'SPORT MASSAGE',
  'PAKET SPORT MASSAGE',
  'TOKO',
  'LAINNYA',
] as const

export const isServiceCategory = (v: string | undefined): v is (typeof SERVICE_CATEGORIES)[number] =>
  !!v && (SERVICE_CATEGORIES as readonly string[]).includes(v)

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// supabase-js builder generics don't survive being passed through a callback;
// callers get rows back typed via `T`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryBuilder = any
type Builder = QueryBuilder
interface SupabaseLike { from: (table: string) => Builder }

/**
 * `transactions` rows attributed to a therapist: `fisio_id = id`, or
 * `fisio_id` empty and the linked visit's `attending_staff_id = id` — the
 * same rule `resolveTherapistNames` uses for the name shown in tables.
 *
 * Runs as two queries (PostgREST can't OR across an embedded table); `apply`
 * adds the caller's other filters / order / limit to both. Rows come back
 * unsorted and unpaginated — callers merge-sort and slice. Volume is bounded
 * by one therapist's transactions, so this stays small.
 */
export async function selectAttributedTransactions<T>(
  supabase: SupabaseLike,
  select: string,
  therapistId: string,
  apply: (q: Builder) => Builder = (q) => q,
): Promise<T[]> {
  const direct = apply(supabase.from('transactions').select(select).eq('fisio_id', therapistId))
  const viaVisit = apply(
    supabase
      .from('transactions')
      .select(`${select}, patient_visits!visit_id!inner(attending_staff_id)`)
      .is('fisio_id', null)
      .eq('patient_visits.attending_staff_id', therapistId),
  )
  const [a, b] = await Promise.all([direct, viaVisit])
  if (a.error) throw new Error(a.error.message)
  if (b.error) throw new Error(b.error.message)
  return [...(a.data ?? []), ...(b.data ?? [])].map((r: Record<string, unknown>) => {
    const { patient_visits: _drop, ...rest } = r // eslint-disable-line @typescript-eslint/no-unused-vars
    return rest as T
  })
}

/** Newest first, id as tiebreak — matches `.order('transaction_date').order('id')` desc. */
export function byDateDesc(a: { transaction_date: string; id: string }, b: { transaction_date: string; id: string }) {
  return b.transaction_date.localeCompare(a.transaction_date) || b.id.localeCompare(a.id)
}
