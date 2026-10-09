// Settles a payment link against DOKU's own status API. Shared by the webhook,
// the panel's polling and the manual "Cek status" button — a webhook body is
// only a signal; the status applied is always the one re-fetched from DOKU.
// Runs with the service role (the webhook has no user session).

import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPatientPII } from '@/lib/encryption'
import { logActivity } from '@/lib/activityLog'
import { PAYMENT_RECEIPT_BUCKET } from '@/lib/paymentProof'
import { getOrder, normalizeOrder, type GatewayMode, type NormalizedOrder } from './client'
import { channelLabel, type PaymentLinkMethod } from './channels'
import { buildIncomePayload, type OrderContext, type PaidLink, type VisitContext } from './payload'
import { buildReceiptPdf, receiptPath } from './receipt'

type Admin = ReturnType<typeof createAdminClient>

export interface PaymentLinkRow extends PaidLink {
  status: 'pending' | 'paid' | 'expired' | 'failed' | 'cancelled'
  environment: GatewayMode
  expires_at: string
  paid_at: string | null
  payment_channel: string | null
  doku_reference: string | null
  transaction_id: string | null
  receipt_path: string | null
  customer_name: string
}

const LINK_COLS =
  'id, branch_id, patient_id, visit_id, order_id, method, amount, harga, discount, category, description, ' +
  'invoice_number, created_by, status, environment, expires_at, paid_at, payment_channel, doku_reference, ' +
  'transaction_id, receipt_path, customer_name'

function toRow(r: Record<string, unknown>): PaymentLinkRow {
  return {
    ...(r as unknown as PaymentLinkRow),
    method: r.method as PaymentLinkMethod,
    amount: Number(r.amount),
    harga: Number(r.harga ?? 0),
    discount: Number(r.discount ?? 0),
  }
}

export async function findLink(by: { id?: string; invoice?: string }, admin: Admin = createAdminClient()) {
  let q = admin.from('payment_links').select(LINK_COLS)
  q = by.id ? q.eq('id', by.id) : q.eq('invoice_number', by.invoice ?? '')
  const { data } = await q.maybeSingle()
  return data ? toRow(data as unknown as Record<string, unknown>) : null
}

export type SyncResult = { status: PaymentLinkRow['status']; changed: boolean }

/** Re-check one link with DOKU and apply the result. Idempotent and safe to call concurrently. */
export async function syncPaymentLink(link: PaymentLinkRow, admin: Admin = createAdminClient()): Promise<SyncResult> {
  if (link.status === 'paid') {
    await ensureSettlementArtifacts(link, admin)
    return { status: 'paid', changed: false }
  }

  const raw = await getOrder(link.environment, link.invoice_number)
  const order = normalizeOrder(raw ?? {}, new Date(link.expires_at))
  const now = new Date().toISOString()

  if (order.status === 'PAID') {
    // Conditional transition: only the caller that flips the row continues, so a
    // webhook racing a poll can never create two transactions.
    const { data: won } = await admin
      .from('payment_links')
      .update({
        status: 'paid',
        paid_at: order.paidAt ? parseDokuDate(order.paidAt) : now,
        payment_channel: order.channel,
        doku_reference: order.reference,
        raw_status: order.raw,
        updated_at: now,
      })
      .eq('id', link.id)
      .neq('status', 'paid')
      .select(LINK_COLS)
      .maybeSingle()
    if (!won) return { status: 'paid', changed: false }
    const paidLink = toRow(won as unknown as Record<string, unknown>)
    await ensureSettlementArtifacts(paidLink, admin, order)
    return { status: 'paid', changed: true }
  }

  if (order.status === 'EXPIRED' && link.status === 'pending') {
    await admin.from('payment_links')
      .update({ status: 'expired', raw_status: raw, updated_at: now })
      .eq('id', link.id).eq('status', 'pending')
    return { status: 'expired', changed: true }
  }

  if (raw) await admin.from('payment_links').update({ raw_status: raw, updated_at: now }).eq('id', link.id)
  return { status: link.status, changed: false }
}

/** DOKU dates come as "20261009143000" (UTC+7) or ISO; store ISO. */
function parseDokuDate(value: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(value)
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+07:00`).toISOString()
  const t = Date.parse(value)
  return Number.isNaN(t) ? new Date().toISOString() : new Date(t).toISOString()
}

/**
 * The transaction row + PDF receipt + notifications for a paid link. Each step
 * is skipped when already done, so a failed step is retried by the next sync.
 */
async function ensureSettlementArtifacts(link: PaymentLinkRow, admin: Admin, order?: NormalizedOrder) {
  let transactionId = link.transaction_id
  const paidAt = link.paid_at ?? new Date().toISOString()

  if (!transactionId) {
    // A later sync repairing a failed insert must not race the winning caller.
    if (!order && Date.now() - Date.parse(paidAt) < 60_000) return
    transactionId = await insertTransaction(link, admin, paidAt)
    if (!transactionId) return
    await admin.from('payment_links').update({ transaction_id: transactionId }).eq('id', link.id)
    await notifyPaid(link, admin)
  }

  if (!link.receipt_path) {
    try {
      const path = await uploadReceipt(link, admin, paidAt)
      await admin.from('payment_links').update({ receipt_path: path }).eq('id', link.id)
      await admin.from('transactions').update({ receipt_url: path }).eq('id', transactionId)
    } catch (error) {
      console.error('DOKU receipt generation failed', { invoice: link.invoice_number, error })
    }
  }
}

async function insertTransaction(link: PaymentLinkRow, admin: Admin, paidAt: string): Promise<string | null> {
  let orderCtx: OrderContext | null = null
  let visitCtx: VisitContext | null = null

  if (link.order_id) {
    const { data: rows } = await admin
      .from('transactions')
      .select('patient_id, branch_id, visit_id, fisio_id, category, harga, discount, amount, transaction_date')
      .eq('order_id', link.order_id)
      .neq('status', 'rejected')
      .order('transaction_date', { ascending: true })
      .order('created_at', { ascending: true })
    if (rows?.length) {
      const t = rows[0]
      orderCtx = {
        template: {
          patient_id: t.patient_id, branch_id: t.branch_id, visit_id: t.visit_id, fisio_id: t.fisio_id,
          category: t.category, harga: Number(t.harga), discount: Number(t.discount),
        },
        totalPaid: rows.reduce((s, r) => s + Number(r.amount), 0),
      }
    }
  }
  if (!orderCtx && link.visit_id) {
    const { data: v } = await admin
      .from('patient_visits')
      .select('patient_id, branch_id, attending_staff_id, order_id')
      .eq('id', link.visit_id)
      .maybeSingle()
    if (v) visitCtx = v as VisitContext
  }

  const payload = buildIncomePayload(link, { order: orderCtx, visit: visitCtx }, {
    paidAt,
    reference: link.doku_reference,
    channelLabel: channelLabel(link.payment_channel),
  })

  const { data, error } = await admin.from('transactions').insert(payload).select('id').single()
  if (error || !data) {
    console.error('DOKU paid link: transaction insert failed', { invoice: link.invoice_number, error })
    return null
  }

  await logActivity({
    supabase: admin,
    userId: link.created_by,
    action: 'create',
    resourceType: 'transaction',
    resourceId: data.id,
    resourceLabel: `${payload.category} — Rp${link.amount} (DOKU ${link.invoice_number})`,
    branchId: payload.branch_id,
    newValues: payload,
  })
  return data.id
}

async function uploadReceipt(link: PaymentLinkRow, admin: Admin, paidAt: string): Promise<string> {
  const [{ data: branch }, patient] = await Promise.all([
    admin.from('branches').select('name, address, phone').eq('id', link.branch_id).maybeSingle(),
    link.patient_id
      ? admin.from('patients').select('encrypted_name, encrypted_phone, no_rm').eq('id', link.patient_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  let patientName = link.customer_name
  let noRm: string | null = null
  if (patient.data) {
    noRm = patient.data.no_rm ?? null
    try {
      patientName = decryptPatientPII({
        encrypted_name: patient.data.encrypted_name, encrypted_phone: patient.data.encrypted_phone ?? '',
      }).name || patientName
    } catch { /* keep customer_name */ }
  }

  const pdf = buildReceiptPdf({
    invoiceNumber: link.invoice_number,
    branchName: branch?.name ?? 'Gang Sehat',
    branchAddress: branch?.address ?? null,
    branchPhone: branch?.phone ?? null,
    patientName,
    noRm,
    category: link.category,
    description: link.description,
    amount: link.amount,
    harga: link.harga,
    discount: link.discount,
    channel: link.payment_channel,
    reference: link.doku_reference,
    paidAt,
    environment: link.environment,
  })
  const path = receiptPath(link.invoice_number, paidAt)
  const { error } = await admin.storage
    .from(PAYMENT_RECEIPT_BUCKET)
    .upload(path, new Uint8Array(pdf), { contentType: 'application/pdf', upsert: true })
  if (error) throw error
  return path
}

async function notifyPaid(link: PaymentLinkRow, admin: Admin) {
  const amount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(link.amount)
  const message = `${amount} · ${link.customer_name} · ${channelLabel(link.payment_channel)} · ${link.invoice_number}`
  const base = { title: 'Pembayaran Online Diterima', message, link: '/finance/payment-links' }
  const rows: Record<string, unknown>[] = [
    { ...base, target_role: 'director' },
    { ...base, target_role: 'finance' },
  ]
  if (link.created_by) rows.push({ ...base, user_id: link.created_by })
  const { error } = await admin.from('user_notifications').insert(rows)
  if (error) console.error('DOKU paid link: notification failed', error)
}
