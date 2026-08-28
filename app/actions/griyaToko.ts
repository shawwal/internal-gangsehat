'use server'

import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activityLog'
import { createTransactionManual } from '@/app/actions/transactions'

const WRITE_ROLES = ['director', 'manager', 'admin']

type SupaClient = Awaited<ReturnType<typeof createClient>>
type AuthOk = { supabase: SupaClient; userId: string; role: string; branchId: string | null }
type AuthResult = AuthOk | { error: string }

async function requireWrite(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }
  const { data: profile } = await supabase
    .from('internal_profiles').select('role, branch_id').eq('id', user.id).single()
  if (!profile) return { error: 'Profil tidak ditemukan' }
  if (!WRITE_ROLES.includes(profile.role)) return { error: 'Tidak memiliki akses' }
  return { supabase, userId: user.id, role: profile.role as string, branchId: profile.branch_id as string | null }
}

// ── Products ────────────────────────────────────────────────────────────────

export interface GriyaProduct {
  id: string
  branch_id: string
  name: string
  category: string
  sku: string | null
  price: number
  stock: number
  is_active: boolean
  notes: string | null
}

export async function fetchProducts(
  branchId: string,
  opts?: { activeOnly?: boolean; search?: string },
): Promise<GriyaProduct[]> {
  const supabase = await createClient()
  let q = supabase
    .from('griya_products')
    .select('id, branch_id, name, category, sku, price, stock, is_active, notes')
    .eq('branch_id', branchId)
    .order('name', { ascending: true })
  if (opts?.activeOnly) q = q.eq('is_active', true)
  if (opts?.search) q = q.ilike('name', `%${opts.search}%`)
  const { data } = await q
  return (data ?? []) as GriyaProduct[]
}

export async function upsertProduct(input: {
  id?: string
  branch_id: string
  name: string
  category: string
  sku?: string | null
  price: number
  stock?: number
  is_active?: boolean
  notes?: string | null
}): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const payload: Record<string, unknown> = {
    branch_id: input.branch_id,
    name: input.name.trim(),
    category: input.category,
    sku: input.sku?.trim() || null,
    price: input.price,
    notes: input.notes?.trim() || null,
    is_active: input.is_active ?? true,
    created_by: a.userId,
  }
  if (input.id) payload.id = input.id
  else payload.stock = input.stock ?? 0

  const { data, error } = await a.supabase
    .from('griya_products')
    .upsert(payload, { onConflict: 'id' })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await logActivity({
    supabase: a.supabase, userId: a.userId, action: input.id ? 'update' : 'create',
    resourceType: 'griya_product', resourceId: data?.id, resourceLabel: input.name,
    branchId: input.branch_id,
  })
  return { error: null }
}

export async function toggleProductActive(id: string, isActive: boolean): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { error } = await a.supabase.from('griya_products').update({ is_active: isActive }).eq('id', id)
  return { error: error?.message ?? null }
}

export async function deleteProduct(id: string): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { count } = await a.supabase
    .from('griya_sale_items').select('id', { count: 'exact', head: true }).eq('product_id', id)
  if ((count ?? 0) > 0) {
    // keep history — soft-disable instead
    const { error } = await a.supabase.from('griya_products').update({ is_active: false }).eq('id', id)
    return { error: error?.message ?? null }
  }
  const { error } = await a.supabase.from('griya_products').delete().eq('id', id)
  return { error: error?.message ?? null }
}

export async function adjustStock(
  productId: string,
  delta: number,
  reason: 'restock' | 'adjustment',
  note?: string,
): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }

  const { data: prod } = await a.supabase
    .from('griya_products').select('branch_id, stock, name').eq('id', productId).single()
  if (!prod) return { error: 'Produk tidak ditemukan' }
  if (prod.stock + delta < 0) return { error: 'Stok tidak boleh negatif' }

  const { error: e1 } = await a.supabase
    .from('griya_products').update({ stock: prod.stock + delta }).eq('id', productId)
  if (e1) return { error: e1.message }

  await a.supabase.from('griya_stock_movements').insert({
    product_id: productId, branch_id: prod.branch_id, delta, reason,
    note: note?.trim() || null, created_by: a.userId,
  })
  await logActivity({
    supabase: a.supabase, userId: a.userId, action: 'update', resourceType: 'griya_product',
    resourceId: productId, resourceLabel: prod.name as string, branchId: prod.branch_id as string,
    newValues: { stock_delta: delta, reason },
  })
  return { error: null }
}

// ── Sales ───────────────────────────────────────────────────────────────────

export interface SaleItemInput { product_id: string; qty: number }

export async function createSale(input: {
  branch_id: string
  patient_id?: string | null
  items: SaleItemInput[]
  discount: number
  payment_method: string
  amount_paid: number
  sale_date: string
  notes?: string | null
}): Promise<{ error: string | null; saleId?: string }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  if (input.items.length === 0) return { error: 'Keranjang kosong' }

  // Compute total for the transaction + payment status
  const { data: prods } = await a.supabase
    .from('griya_products')
    .select('id, price, name')
    .in('id', input.items.map((i) => i.product_id))
  const priceMap = new Map((prods ?? []).map((p) => [p.id, { price: Number(p.price), name: p.name as string }]))
  let subtotal = 0
  for (const it of input.items) subtotal += (priceMap.get(it.product_id)?.price ?? 0) * it.qty
  const total = Math.max(subtotal - input.discount, 0)
  const paid = Math.min(input.amount_paid, total)
  const payStatus = paid >= total ? 'LUNAS' : 'DP'

  const { data: saleId, error: rpcErr } = await a.supabase.rpc('griya_create_sale', {
    p: {
      branch_id: input.branch_id,
      patient_id: input.patient_id ?? null,
      sold_by: a.userId,
      sale_date: input.sale_date,
      discount: input.discount,
      payment_method: input.payment_method,
      payment_status: payStatus,
      amount_paid: paid,
      notes: input.notes ?? null,
      items: input.items,
    },
  })
  if (rpcErr || !saleId) return { error: rpcErr?.message ?? 'Gagal menyimpan penjualan' }

  // Money side: one income transaction so it flows into finance reports
  const first = priceMap.get(input.items[0].product_id)?.name ?? 'Barang'
  const desc = input.items.length > 1 ? `${input.items.length} item · ${first} dll.` : `${first} ×${input.items[0].qty}`
  const { error: txErr } = await createTransactionManual({
    type: 'income',
    category: 'TOKO',
    harga: total,
    amount: paid,
    discount: 0,
    payment_method: input.payment_method,
    payment_status: payStatus,
    penjamin: null,
    description: desc,
    transaction_date: input.sale_date,
    patient_id: input.patient_id ?? null,
    branch_id: input.branch_id,
  })
  if (!txErr) {
    // link the transaction back (best-effort — find the just-created row)
    const { data: tx } = await a.supabase
      .from('transactions')
      .select('id')
      .eq('branch_id', input.branch_id)
      .eq('category', 'TOKO')
      .eq('transaction_date', input.sale_date)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (tx?.id) await a.supabase.from('griya_sales').update({ transaction_id: tx.id }).eq('id', saleId)
  }

  await logActivity({
    supabase: a.supabase, userId: a.userId, action: 'create', resourceType: 'griya_sale',
    resourceId: saleId as string, resourceLabel: desc, branchId: input.branch_id,
    newValues: { total, paid, items: input.items.length },
  })
  return { error: txErr ? `Penjualan tersimpan, tapi gagal mencatat pemasukan: ${txErr}` : null, saleId: saleId as string }
}

export interface SaleRow {
  id: string
  sale_date: string
  subtotal: number
  discount: number
  total: number
  amount_paid: number
  payment_method: string | null
  payment_status: string
  status: string
  patient_id: string | null
  notes: string | null
}

export async function fetchSales(
  branchId: string, range: { from: string; toExclusive: string },
): Promise<SaleRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('griya_sales')
    .select('id, sale_date, subtotal, discount, total, amount_paid, payment_method, payment_status, status, patient_id, notes')
    .eq('branch_id', branchId)
    .gte('sale_date', range.from)
    .lt('sale_date', range.toExclusive)
    .order('sale_date', { ascending: false })
    .order('created_at', { ascending: false })
  return (data ?? []) as SaleRow[]
}

export interface SaleItemRow {
  id: string; product_name: string; qty: number; unit_price: number; subtotal: number
}

export async function fetchSaleItems(saleId: string): Promise<SaleItemRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('griya_sale_items')
    .select('id, product_name, qty, unit_price, subtotal')
    .eq('sale_id', saleId)
  return (data ?? []) as SaleItemRow[]
}

/** Restore stock for a sale's line items (+movement rows). Best-effort. */
async function restockFromSale(a: AuthOk, saleId: string, branchId: string) {
  const { data: items } = await a.supabase
    .from('griya_sale_items').select('product_id, qty').eq('sale_id', saleId)
  for (const it of items ?? []) {
    if (!it.product_id) continue
    const { data: p } = await a.supabase.from('griya_products').select('stock').eq('id', it.product_id).single()
    if (!p) continue
    await a.supabase.from('griya_products').update({ stock: p.stock + it.qty }).eq('id', it.product_id)
    await a.supabase.from('griya_stock_movements').insert({
      product_id: it.product_id, branch_id: branchId, delta: it.qty,
      reason: 'void', sale_id: saleId, created_by: a.userId,
    })
  }
}

export async function voidSale(saleId: string): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }

  const { data: sale } = await a.supabase
    .from('griya_sales').select('branch_id, status, transaction_id').eq('id', saleId).single()
  if (!sale) return { error: 'Penjualan tidak ditemukan' }
  if (sale.status === 'void') return { error: 'Penjualan sudah dibatalkan' }

  await restockFromSale(a, saleId, sale.branch_id as string)

  await a.supabase.from('griya_sales').update({ status: 'void' }).eq('id', saleId)
  if (sale.transaction_id) {
    await a.supabase.from('transactions')
      .update({ status: 'rejected', rejection_reason: 'Penjualan toko dibatalkan' })
      .eq('id', sale.transaction_id)
  }

  await logActivity({
    supabase: a.supabase, userId: a.userId, action: 'update', resourceType: 'griya_sale',
    resourceId: saleId, branchId: sale.branch_id as string, newValues: { status: 'void' },
  })
  return { error: null }
}

/** Hard-delete a sale from history. Restores stock if it was still completed,
 *  removes the linked income transaction, then deletes the sale (+items cascade). */
export async function deleteSale(saleId: string): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }

  const { data: sale } = await a.supabase
    .from('griya_sales').select('branch_id, status, transaction_id').eq('id', saleId).single()
  if (!sale) return { error: 'Penjualan tidak ditemukan' }

  if (sale.status === 'completed') {
    await restockFromSale(a, saleId, sale.branch_id as string)
  }
  if (sale.transaction_id) {
    await a.supabase.from('transactions').delete().eq('id', sale.transaction_id)
  }
  // detach movements (sale_id FK is ON DELETE SET NULL), then delete the sale
  await a.supabase.from('griya_stock_movements').update({ sale_id: null }).eq('sale_id', saleId)
  const { error } = await a.supabase.from('griya_sales').delete().eq('id', saleId)
  if (error) return { error: error.message }

  await logActivity({
    supabase: a.supabase, userId: a.userId, action: 'delete', resourceType: 'griya_sale',
    resourceId: saleId, branchId: sale.branch_id as string,
  })
  return { error: null }
}
