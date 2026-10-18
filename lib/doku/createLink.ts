import type { SupabaseClient } from '@supabase/supabase-js'
import { createCheckout, type GatewayMode } from '@/lib/doku/client'
import { paymentMethodTypes, type PaymentLinkMethod } from '@/lib/doku/channels'

// Insert a payment_links row and open its DOKU checkout. Shared by the staff
// action (app/actions/paymentLinks.ts, user-session client) and online booking
// (lib/onlineBooking/service.ts, service client, created_by NULL). On a DOKU
// failure the row is deleted so no dangling pending link is left.

export interface PaymentLinkRow {
  branch_id: string
  patient_id: string | null
  visit_id: string | null
  order_id: string | null
  toko_sale_id?: string | null
  online_booking_id?: string | null
  method: PaymentLinkMethod
  amount: number
  harga: number
  discount: number
  category: string
  description: string | null
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  invoice_number: string
  environment: GatewayMode
  status: 'pending'
  expires_at: string
  created_by: string | null
}

export async function insertPaymentLinkWithCheckout(
  supabase: SupabaseClient,
  mode: GatewayMode,
  row: PaymentLinkRow,
  opts: { dueMinutes: number; returnUrl: string },
): Promise<{ id: string; checkoutUrl: string; error: null } | { id: null; checkoutUrl: null; error: string }> {
  const { data: inserted, error: insErr } = await supabase.from('payment_links').insert(row).select('id').single()
  if (insErr || !inserted) return { id: null, checkoutUrl: null, error: insErr?.message ?? 'Gagal menyimpan link pembayaran' }

  try {
    const checkout = await createCheckout(mode, {
      invoiceNumber: row.invoice_number,
      amount: row.amount,
      itemName: row.description ? `${row.category} - ${row.description}` : row.category,
      category: row.category,
      paymentMethodTypes: paymentMethodTypes(row.method, process.env.DOKU_VA_CHANNELS),
      dueMinutes: opts.dueMinutes,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      customerEmail: row.customer_email,
      returnUrl: opts.returnUrl,
    })
    await supabase.from('payment_links').update({ checkout_url: checkout.url, updated_at: new Date().toISOString() }).eq('id', inserted.id)
    return { id: inserted.id, checkoutUrl: checkout.url, error: null }
  } catch (error) {
    console.error('DOKU createCheckout failed', error)
    await supabase.from('payment_links').delete().eq('id', inserted.id)
    if (String(error).includes('PAYMENT CHANNEL IS INACTIVE')) {
      return {
        id: null, checkoutUrl: null,
        error: `Channel ${row.method === 'QRIS' ? 'QRIS' : 'Virtual Account'} belum aktif di merchant DOKU (${mode === 'production' ? 'live' : 'sandbox'}). Aktifkan di dashboard DOKU.`,
      }
    }
    return { id: null, checkoutUrl: null, error: 'DOKU menolak pembuatan link. Coba lagi atau periksa konfigurasi merchant.' }
  }
}
