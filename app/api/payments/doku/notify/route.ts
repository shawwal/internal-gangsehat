import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { configuredModes, validNotification, type GatewayMode } from '@/lib/doku/client'
import { isOurInvoice } from '@/lib/doku/invoice'
import { findLink, syncPaymentLink } from '@/lib/doku/settle'

/**
 * DOKU payment notifications (exempted from auth in proxy.ts). A delivery is
 * only a signal: after the signature checks out, the order's status is
 * re-fetched from DOKU with our own keys and that confirmed status is applied.
 */
export async function POST(request: NextRequest) {
  const modes = configuredModes()
  if (modes.length === 0) return NextResponse.json({ error: 'DOKU is not configured' }, { status: 500 })

  // The signature covers the exact bytes DOKU sent.
  const rawBody = await request.text()
  const headers = {
    clientId: request.headers.get('client-id'),
    requestId: request.headers.get('request-id'),
    requestTimestamp: request.headers.get('request-timestamp'),
    signature: request.headers.get('signature'),
  }
  // Sandbox and live orders can both reach this URL; the matching key says which.
  const mode: GatewayMode | undefined = modes.find((m) => validNotification(headers, rawBody, m))
  if (!mode) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  let body: { order?: { invoice_number?: string } }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const invoice = body.order?.invoice_number
  // Not one of ours (the merchant is shared with other sites): acknowledge so DOKU stops retrying.
  if (!isOurInvoice(invoice)) return NextResponse.json({ ok: true })

  const admin = createAdminClient()
  const link = await findLink({ invoice }, admin)
  if (!link) return NextResponse.json({ ok: true })

  await admin.from('payment_links')
    .update({ last_notification: body, updated_at: new Date().toISOString() })
    .eq('id', link.id)

  try {
    // Orders exist only on the host they were created on — trust the verified key's mode.
    const result = await syncPaymentLink(link.environment === mode ? link : { ...link, environment: mode }, admin)
    return NextResponse.json({ ok: true, status: result.status })
  } catch (error) {
    console.error('DOKU webhook: could not confirm order', { invoice, error })
    // Non-2xx so DOKU retries; the panel's polling also re-checks.
    return NextResponse.json({ error: 'Could not confirm order' }, { status: 502 })
  }
}
