'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPatientPII } from '@/lib/encryption'
import { logActivity } from '@/lib/activityLog'
import { createCheckout, dokuEnabled, gatewayMode } from '@/lib/doku/client'
import { DEFAULT_DUE_MINUTES, paymentMethodTypes, type PaymentLinkMethod } from '@/lib/doku/channels'
import { newInvoiceNumber } from '@/lib/doku/invoice'
import { findLink, releaseTokoSale, syncPaymentLink } from '@/lib/doku/settle'
import { PAYMENT_RECEIPT_BUCKET } from '@/lib/paymentProof'
import { orderBills, visitBill, type BillOption } from '@/lib/doku/bills'
import { SERVICE_TO_CATEGORY } from '@/lib/serviceType'
import { fetchLayananHarga, getPatientOutstanding } from '@/app/actions/transactions'
import type { ServiceType } from '@/types'
import type { PaymentLinkView, PaymentLinkFilters, PaymentLinkStatus } from '@/components/payment-links/types'

const PAYMENT_ROLES = ['finance', 'manager', 'director', 'admin']
const PAGE_SIZE = 10

const VIEW_COLS =
  'id, created_at, branch_id, patient_id, visit_id, order_id, transaction_id, method, amount, harga, discount, ' +
  'category, description, customer_name, customer_phone, customer_email, invoice_number, checkout_url, environment, ' +
  'status, expires_at, sent_at, sent_via, paid_at, payment_channel, doku_reference, receipt_path, toko_sale_id, ' +
  'branches!branch_id(name), internal_profiles!created_by(full_name)'

function toView(r: Record<string, unknown>): PaymentLinkView {
  const branch = r.branches as { name?: string } | null
  const creator = r.internal_profiles as { full_name?: string } | null
  return {
    id: r.id as string,
    created_at: r.created_at as string,
    branch_id: r.branch_id as string,
    branch_name: branch?.name ?? null,
    patient_id: (r.patient_id as string | null) ?? null,
    visit_id: (r.visit_id as string | null) ?? null,
    order_id: (r.order_id as string | null) ?? null,
    transaction_id: (r.transaction_id as string | null) ?? null,
    toko_sale_id: (r.toko_sale_id as string | null) ?? null,
    method: r.method as PaymentLinkMethod,
    amount: Number(r.amount),
    category: r.category as string,
    description: (r.description as string | null) ?? null,
    customer_name: r.customer_name as string,
    customer_phone: (r.customer_phone as string | null) ?? null,
    invoice_number: r.invoice_number as string,
    checkout_url: (r.checkout_url as string | null) ?? null,
    environment: r.environment as PaymentLinkView['environment'],
    status: r.status as PaymentLinkStatus,
    expires_at: r.expires_at as string,
    sent_at: (r.sent_at as string | null) ?? null,
    sent_via: (r.sent_via as PaymentLinkView['sent_via']) ?? null,
    paid_at: (r.paid_at as string | null) ?? null,
    payment_channel: (r.payment_channel as string | null) ?? null,
    doku_reference: (r.doku_reference as string | null) ?? null,
    has_receipt: !!r.receipt_path,
    created_by_name: creator?.full_name ?? null,
  }
}

async function requirePaymentRole() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' as const }
  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()
  if (!profile || !PAYMENT_ROLES.includes(profile.role)) {
    return { error: 'Tidak memiliki akses untuk pembayaran online' as const }
  }
  return { supabase, user, profile: profile as { role: string; branch_id: string | null } }
}

/** Fetch one link through RLS (proves the caller may see it). */
async function fetchView(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase.from('payment_links').select(VIEW_COLS).eq('id', id).maybeSingle()
  return data ? toView(data as unknown as Record<string, unknown>) : null
}

// ── Create ───────────────────────────────────────────────────────────────────

export interface CreatePaymentLinkInput {
  method: PaymentLinkMethod
  amount: number
  category: string
  description?: string | null
  patientId?: string | null
  visitId?: string | null
  orderId?: string | null
  harga?: number | null
  discount?: number | null
  customerName?: string | null
  customerPhone?: string | null
  customerEmail?: string | null
  /** Director only (no own branch); others are always scoped to their branch. */
  branchId?: string | null
  dueMinutes?: number | null
  /** Pending toko sale this link pays for (settled into a TOKO transaction). */
  tokoSaleId?: string | null
}

export async function createPaymentLink(
  input: CreatePaymentLinkInput,
): Promise<{ data: PaymentLinkView | null; error: string | null }> {
  const auth = await requirePaymentRole()
  if ('error' in auth) return { data: null, error: auth.error ?? null }
  const { supabase, user, profile } = auth

  if (!dokuEnabled()) return { data: null, error: 'DOKU belum dikonfigurasi di server (PAYMENT_GATEWAY_MODE / DOKU_* env).' }
  const mode = gatewayMode()!
  if (input.method !== 'QRIS' && input.method !== 'VA') return { data: null, error: 'Metode tidak valid' }
  const amount = Math.round(Number(input.amount))
  if (!Number.isFinite(amount) || amount < 1000) return { data: null, error: 'Nominal minimal Rp1.000' }
  if (!input.category) return { data: null, error: 'Kategori wajib diisi' }

  // Resolve branch + patient from the most specific target.
  let branchId: string | null = null
  let patientId = input.patientId ?? null
  if (input.tokoSaleId) {
    const { data: sale } = await supabase.from('griya_sales').select('branch_id, patient_id, status').eq('id', input.tokoSaleId).maybeSingle()
    if (!sale || sale.status !== 'pending_payment') return { data: null, error: 'Penjualan toko tidak ditemukan' }
    branchId = sale.branch_id
    patientId = patientId ?? sale.patient_id
  } else if (input.visitId) {
    const { data: v } = await supabase.from('patient_visits').select('branch_id, patient_id').eq('id', input.visitId).maybeSingle()
    if (!v) return { data: null, error: 'Kunjungan tidak ditemukan' }
    branchId = v.branch_id
    patientId = patientId ?? v.patient_id
  } else if (input.orderId) {
    const { data: t } = await supabase.from('transactions').select('branch_id, patient_id')
      .eq('order_id', input.orderId).neq('status', 'rejected').limit(1).maybeSingle()
    if (t) { branchId = t.branch_id; patientId = patientId ?? t.patient_id }
  }
  branchId = branchId ?? profile.branch_id ?? (profile.role === 'director' ? input.branchId ?? null : null)
  if (!branchId) return { data: null, error: 'Pilih cabang untuk link pembayaran ini' }

  let customerName = input.customerName?.trim() || ''
  let customerPhone = input.customerPhone?.trim() || null
  if (patientId && (!customerName || !customerPhone)) {
    const { data: p } = await supabase.from('patients').select('encrypted_name, encrypted_phone').eq('id', patientId).maybeSingle()
    if (p) {
      const pii = decryptPatientPII({ encrypted_name: p.encrypted_name, encrypted_phone: p.encrypted_phone ?? '' })
      customerName = customerName || pii.name
      customerPhone = customerPhone || pii.phone || null
    }
  }
  if (!customerName && input.tokoSaleId) customerName = 'Pelanggan Toko'
  if (!customerName) return { data: null, error: 'Nama pembayar wajib diisi' }

  // Reuse an open link for the same target, method and amount (avoids duplicate
  // DOKU orders when the dialog is opened twice).
  let reuse = supabase.from('payment_links').select(VIEW_COLS)
    .eq('status', 'pending').eq('method', input.method).eq('amount', amount).eq('environment', mode)
    .gt('expires_at', new Date(Date.now() + 5 * 60_000).toISOString())
    .not('checkout_url', 'is', null)
  reuse = input.tokoSaleId ? reuse.eq('toko_sale_id', input.tokoSaleId)
    : input.visitId ? reuse.eq('visit_id', input.visitId)
    : input.orderId ? reuse.eq('order_id', input.orderId)
    : patientId ? reuse.eq('patient_id', patientId).is('visit_id', null).is('order_id', null).is('toko_sale_id', null)
    : reuse.eq('customer_name', customerName).is('patient_id', null).is('toko_sale_id', null)
  const { data: existing } = await reuse.order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (existing) return { data: toView(existing as unknown as Record<string, unknown>), error: null }

  const dueMinutes = Math.min(Math.max(Math.round(input.dueMinutes ?? DEFAULT_DUE_MINUTES[input.method]), 5), 60 * 24 * 7)
  const invoiceNumber = newInvoiceNumber()
  const row = {
    branch_id: branchId,
    patient_id: patientId,
    visit_id: input.visitId ?? null,
    order_id: input.orderId ?? null,
    toko_sale_id: input.tokoSaleId ?? null,
    method: input.method,
    amount,
    harga: Math.max(Number(input.harga ?? 0) || 0, 0),
    discount: Math.max(Number(input.discount ?? 0) || 0, 0),
    category: input.category,
    description: input.description?.trim() || null,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: input.customerEmail?.trim() || null,
    invoice_number: invoiceNumber,
    environment: mode,
    status: 'pending',
    expires_at: new Date(Date.now() + dueMinutes * 60_000).toISOString(),
    created_by: user.id,
  }

  const { data: inserted, error: insErr } = await supabase.from('payment_links').insert(row).select('id').single()
  if (insErr || !inserted) return { data: null, error: insErr?.message ?? 'Gagal menyimpan link pembayaran' }

  try {
    const checkout = await createCheckout(mode, {
      invoiceNumber,
      amount,
      itemName: row.description ? `${row.category} - ${row.description}` : row.category,
      category: row.category,
      paymentMethodTypes: paymentMethodTypes(input.method, process.env.DOKU_VA_CHANNELS),
      dueMinutes,
      customerName,
      customerPhone,
      customerEmail: row.customer_email,
      returnUrl: process.env.PAYMENT_RETURN_URL || 'https://gangsehat.com',
    })
    await supabase.from('payment_links').update({ checkout_url: checkout.url, updated_at: new Date().toISOString() }).eq('id', inserted.id)
  } catch (error) {
    console.error('DOKU createCheckout failed', error)
    await supabase.from('payment_links').delete().eq('id', inserted.id)
    if (String(error).includes('PAYMENT CHANNEL IS INACTIVE')) {
      return {
        data: null,
        error: `Channel ${input.method === 'QRIS' ? 'QRIS' : 'Virtual Account'} belum aktif di merchant DOKU (${mode === 'production' ? 'live' : 'sandbox'}). Aktifkan di dashboard DOKU.`,
      }
    }
    return { data: null, error: 'DOKU menolak pembuatan link. Coba lagi atau periksa konfigurasi merchant.' }
  }

  await logActivity({
    supabase,
    userId: user.id,
    action: 'create',
    resourceType: 'payment_link',
    resourceId: inserted.id,
    resourceLabel: `${input.method} ${row.category} — Rp${amount} (${invoiceNumber})`,
    branchId,
    patientId,
    newValues: row,
  })

  return { data: await fetchView(supabase, inserted.id), error: null }
}

// ── Defaults (smart prefill) ─────────────────────────────────────────────────

export interface PaymentLinkDefaults {
  patient: { id: string; name: string; phone: string | null; no_rm: string | null } | null
  branchId: string | null
  bills: BillOption[]
  /** An open link for the same visit/order — offer to reopen instead of duplicating. */
  openLink: PaymentLinkView | null
}

/**
 * Everything the create dialog can fill in by itself from a visit / order /
 * patient: who pays, and what they're paying for (this visit's price-list
 * price + the patient's outstanding order balances).
 */
export async function getPaymentLinkDefaults(target: {
  visitId?: string | null
  orderId?: string | null
  patientId?: string | null
}): Promise<PaymentLinkDefaults> {
  const empty: PaymentLinkDefaults = { patient: null, branchId: null, bills: [], openLink: null }
  const auth = await requirePaymentRole()
  if ('error' in auth) return empty
  const { supabase } = auth

  let patientId = target.patientId ?? null
  let branchId: string | null = null
  let visit: BillOption | null = null

  if (target.visitId) {
    const [{ data: v }, { count: paidCount }] = await Promise.all([
      supabase.from('patient_visits')
        .select('patient_id, branch_id, service_type, layanan_id, package_id')
        .eq('id', target.visitId).maybeSingle(),
      supabase.from('transactions').select('id', { count: 'exact', head: true })
        .eq('visit_id', target.visitId).neq('status', 'rejected'),
    ])
    if (v) {
      patientId = patientId ?? v.patient_id
      branchId = v.branch_id
      // Package sessions are billed through the package order, not per visit.
      if (!paidCount && !v.package_id && v.service_type) {
        const category = SERVICE_TO_CATEGORY[v.service_type as ServiceType] ?? 'LAINNYA'
        let price: number | null = null
        let description: string | null = null
        if (v.service_type === 'SPORT MASSAGE' && v.layanan_id) {
          const { data: l } = await supabase.from('internal_layanan').select('nama, harga').eq('id', v.layanan_id).maybeSingle()
          if (l) { price = Number(l.harga); description = l.nama }
        } else if (v.service_type !== 'SPORT MASSAGE') {
          price = await fetchLayananHarga(v.service_type, v.branch_id)
        }
        visit = visitBill({ visitId: target.visitId, category, price, description })
      }
    }
  } else if (target.orderId) {
    const { data: t } = await supabase.from('transactions').select('patient_id, branch_id')
      .eq('order_id', target.orderId).neq('status', 'rejected').limit(1).maybeSingle()
    if (t) { patientId = patientId ?? t.patient_id; branchId = t.branch_id }
  }

  let patient: PaymentLinkDefaults['patient'] = null
  let outstanding: Awaited<ReturnType<typeof getPatientOutstanding>> = []
  if (patientId) {
    const [{ data: p }, out] = await Promise.all([
      supabase.from('patients').select('id, encrypted_name, encrypted_phone, no_rm').eq('id', patientId).maybeSingle(),
      getPatientOutstanding(patientId),
    ])
    outstanding = out
    if (p) {
      const pii = decryptPatientPII({ encrypted_name: p.encrypted_name, encrypted_phone: p.encrypted_phone ?? '' })
      patient = { id: p.id, name: pii.name, phone: pii.phone || null, no_rm: p.no_rm ?? null }
    }
  }

  const bills = orderBills(visit, outstanding.map((o) => ({
    order_id: o.order_id, category: o.category,
    harga: Number(o.harga), discount: Number(o.discount), outstanding: Number(o.outstanding),
  })), target.orderId)

  // An open link for any of these bills.
  let openLink: PaymentLinkView | null = null
  const orderIds = bills.map((b) => b.orderId).filter((x): x is string => !!x)
  const ors = [
    ...(target.visitId ? [`visit_id.eq.${target.visitId}`] : []),
    ...(orderIds.length ? [`order_id.in.(${orderIds.map((id) => `"${id}"`).join(',')})`] : []),
  ]
  if (ors.length) {
    const { data } = await supabase.from('payment_links').select(VIEW_COLS)
      .eq('status', 'pending').gt('expires_at', new Date().toISOString())
      .or(ors.join(','))
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (data) openLink = toView(data as unknown as Record<string, unknown>)
  }

  return { patient, branchId, bills, openLink }
}

// ── Status / lifecycle ───────────────────────────────────────────────────────

export async function getPaymentLink(id: string): Promise<PaymentLinkView | null> {
  const auth = await requirePaymentRole()
  if ('error' in auth) return null
  return fetchView(auth.supabase, id)
}

/** Re-check with DOKU now (polling + "Cek status"; the only settle path on localhost). */
export async function checkPaymentLinkStatus(id: string): Promise<{ data: PaymentLinkView | null; error: string | null }> {
  const auth = await requirePaymentRole()
  if ('error' in auth) return { data: null, error: auth.error ?? null }
  const visible = await fetchView(auth.supabase, id)
  if (!visible) return { data: null, error: 'Link tidak ditemukan' }
  if (visible.status === 'paid' && visible.has_receipt && visible.transaction_id) return { data: visible, error: null }

  const admin = createAdminClient()
  const link = await findLink({ id }, admin)
  if (!link) return { data: null, error: 'Link tidak ditemukan' }
  try {
    await syncPaymentLink(link, admin)
  } catch (error) {
    console.error('DOKU status check failed', error)
    return { data: visible, error: 'Gagal menghubungi DOKU. Coba lagi.' }
  }
  return { data: await fetchView(auth.supabase, id), error: null }
}

export async function markPaymentLinkSent(id: string, via: 'whatsapp' | 'copy' | 'screen'): Promise<void> {
  const auth = await requirePaymentRole()
  if ('error' in auth) return
  const now = new Date().toISOString()
  await auth.supabase.from('payment_links').update({
    sent_at: now,
    sent_via: via,
    ...(via === 'screen' ? { opened_on_screen_at: now } : {}),
    updated_at: now,
  }).eq('id', id)
}

/** Local-only: DOKU has no cancel for Checkout; the page simply expires. A
 *  payment that still lands on a cancelled link is recorded anyway. */
export async function cancelPaymentLink(id: string): Promise<{ error: string | null }> {
  const auth = await requirePaymentRole()
  if ('error' in auth) return { error: auth.error ?? null }
  const { data: cancelled, error } = await auth.supabase.from('payment_links')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'pending')
    .select('toko_sale_id').maybeSingle()
  // A cancelled toko link releases its sale's reserved stock.
  if (cancelled?.toko_sale_id) await releaseTokoSale(cancelled.toko_sale_id, createAdminClient(), auth.user.id)
  if (!error) {
    await logActivity({
      supabase: auth.supabase, userId: auth.user.id, action: 'update', resourceType: 'payment_link',
      resourceId: id, oldValues: { status: 'pending' }, newValues: { status: 'cancelled' },
    })
  }
  return { error: error?.message ?? null }
}

/** Latest link of a toko sale (Riwayat → reopen the QR / share panel). */
export async function getPaymentLinkForSale(saleId: string): Promise<PaymentLinkView | null> {
  const auth = await requirePaymentRole()
  if ('error' in auth) return null
  const { data } = await auth.supabase.from('payment_links').select(VIEW_COLS)
    .eq('toko_sale_id', saleId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return data ? toView(data as unknown as Record<string, unknown>) : null
}

export async function getPaymentLinkReceiptUrl(id: string): Promise<string | null> {
  const auth = await requirePaymentRole()
  if ('error' in auth) return null
  const { data } = await auth.supabase.from('payment_links').select('receipt_path').eq('id', id).maybeSingle()
  if (!data?.receipt_path) return null
  const { data: signed } = await auth.supabase.storage.from(PAYMENT_RECEIPT_BUCKET).createSignedUrl(data.receipt_path, 60 * 60)
  return signed?.signedUrl ?? null
}

// ── List ─────────────────────────────────────────────────────────────────────

export async function listPaymentLinks(
  filters: PaymentLinkFilters,
  page = 1,
): Promise<{ rows: PaymentLinkView[]; count: number; pageSize: number }> {
  const auth = await requirePaymentRole()
  if ('error' in auth) return { rows: [], count: 0, pageSize: PAGE_SIZE }
  const from = (Math.max(page, 1) - 1) * PAGE_SIZE

  let q = auth.supabase.from('payment_links').select(VIEW_COLS, { count: 'exact' })
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.method) q = q.eq('method', filters.method)
  if (filters.patientId) q = q.eq('patient_id', filters.patientId)
  if (filters.visitId) q = q.eq('visit_id', filters.visitId)
  if (filters.branchId && auth.profile.role === 'director') q = q.eq('branch_id', filters.branchId)
  const term = filters.search?.trim().replace(/[%,()]/g, '')
  if (term) q = q.or(`customer_name.ilike.%${term}%,invoice_number.ilike.%${term}%`)

  const { data, count } = await q.order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1)
  return {
    rows: (data ?? []).map((r) => toView(r as unknown as Record<string, unknown>)),
    count: count ?? 0,
    pageSize: PAGE_SIZE,
  }
}

/**
 * Fallback when a webhook was missed (localhost, DOKU outage): re-check the
 * caller's still-open links. Called when the payment-links page loads.
 */
export async function syncOpenPaymentLinks(): Promise<number> {
  const auth = await requirePaymentRole()
  if ('error' in auth) return 0
  const { data } = await auth.supabase.from('payment_links').select('id')
    .eq('status', 'pending')
    .gt('created_at', new Date(Date.now() - 8 * 86_400_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(20)
  if (!data?.length) return 0
  const admin = createAdminClient()
  let changed = 0
  await Promise.all(data.map(async ({ id }) => {
    try {
      const link = await findLink({ id }, admin)
      if (link && (await syncPaymentLink(link, admin)).changed) changed++
    } catch (error) {
      console.error('DOKU sync failed', { id, error })
    }
  }))
  return changed
}

/** Branch options for the director's create dialog / filter. */
export async function listBranchesForPaymentLinks(): Promise<{ id: string; name: string }[]> {
  const auth = await requirePaymentRole()
  if ('error' in auth) return []
  const { data } = await auth.supabase.from('branches').select('id, name').eq('is_active', true).order('name')
  return data ?? []
}
