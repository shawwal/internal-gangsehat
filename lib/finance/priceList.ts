import type { SupabaseClient } from '@supabase/supabase-js'
import { isPriceListExempt } from '@/lib/serviceType'

/** Server-side guard: an income category is billable in a branch only when its
 *  Tarif Layanan (internal_layanan) has an active row for it. TOKO / LAINNYA are
 *  exempt. Returns an error message, or null when allowed. */
export async function priceListCategoryError(
  supabase: SupabaseClient,
  branchId: string | null | undefined,
  category: string,
): Promise<string | null> {
  if (!branchId || isPriceListExempt(category)) return null
  const { count, error } = await supabase
    .from('internal_layanan')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .eq('kategori', category)
    .eq('is_active', true)
  if (error) return null // never block a payment on a lookup failure
  return count ? null : `Kategori ${category} belum ada di Tarif Layanan cabang ini. Tambahkan dulu di menu Tarif Layanan.`
}

/** The internal_layanan columns a transaction's Layanan is resolved from. */
export interface LayananForMatch {
  id: string
  branch_id: string
  nama: string
  kategori: string
  harga: number
}

/**
 * The Layanan of an income transaction, as the finance pages show it: the
 * linked visit's booked layanan, else the branch's only layanan in this
 * category at this price, else the category's only layanan. Null when it's
 * ambiguous.
 */
export function pickLayanan<L extends LayananForMatch>(
  tx: { branch_id: string; category: string; harga: number | null },
  bookedLayananId: string | null | undefined,
  layanan: L[],
): L | null {
  const booked = bookedLayananId ? layanan.find((l) => l.id === bookedLayananId) : undefined
  if (booked) return booked
  const sameCat = layanan.filter((l) => l.branch_id === tx.branch_id && l.kategori === tx.category)
  const byPrice = sameCat.filter((l) => Number(l.harga) === Number(tx.harga))
  if (byPrice.length === 1) return byPrice[0]
  if (sameCat.length === 1) return sameCat[0]
  return null
}

/**
 * `pickLayanan` for many rows of one branch: Layanan per transaction id.
 * `columns` adds internal_layanan columns to the returned rows.
 */
export async function resolveTransactionLayanan<L extends LayananForMatch = LayananForMatch>(
  db: Pick<SupabaseClient, 'from'>,
  branchId: string,
  rows: { id: string; branch_id: string; category: string; harga: number | null; visit_id: string | null }[],
  columns = '',
): Promise<Map<string, L>> {
  const out = new Map<string, L>()
  if (!rows.length) return out
  const select = ['id', 'branch_id', 'nama', 'kategori', 'harga', ...columns.split(',').map((c) => c.trim()).filter(Boolean)].join(', ')
  const { data: layanan } = await db.from('internal_layanan').select(select).eq('branch_id', branchId)
  const list = (layanan ?? []) as unknown as L[]
  const visitIds = [...new Set(rows.map((r) => r.visit_id).filter((x): x is string => !!x))]
  const bookedByVisit = new Map<string, string | null>()
  for (let i = 0; i < visitIds.length; i += 300) {
    const { data } = await db.from('patient_visits').select('id, layanan_id').in('id', visitIds.slice(i, i + 300))
    for (const v of (data ?? []) as { id: string; layanan_id: string | null }[]) bookedByVisit.set(v.id, v.layanan_id)
  }
  for (const r of rows) {
    const l = pickLayanan(r, r.visit_id ? bookedByVisit.get(r.visit_id) : null, list)
    if (l) out.set(r.id, l)
  }
  return out
}
