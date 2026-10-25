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
