import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

// DOKU Checkout (non-SNAP): a hosted payment page that renders the QRIS code or
// the VA number itself. Ported from human-atlas lib/server/doku.ts — same DOKU
// merchant (shared with human-atlas and bansa-web). One switch picks sandbox or
// live: PAYMENT_GATEWAY_MODE=development|production, with per-mode keys
// DOKU_CLIENT_ID_<MODE> / DOKU_SECRET_KEY_<MODE>. Server-only (secret keys).

export type GatewayMode = 'development' | 'production'

const CHECKOUT_PATH = '/checkout/v1/payment'
const STATUS_PATH = '/orders/v1/status'
export const DOKU_NOTIFICATION_PATH = '/api/payments/doku/notify'

interface Credentials {
  clientId: string
  secretKey: string
}

export function gatewayMode(): GatewayMode | null {
  const mode = process.env.PAYMENT_GATEWAY_MODE
  return mode === 'development' || mode === 'production' ? mode : null
}

export function credentialsFor(mode: GatewayMode): Credentials | null {
  const suffix = mode === 'production' ? 'PRODUCTION' : 'DEVELOPMENT'
  const clientId = process.env[`DOKU_CLIENT_ID_${suffix}`]
  const secretKey = process.env[`DOKU_SECRET_KEY_${suffix}`]
  return clientId && secretKey ? { clientId, secretKey } : null
}

/** Modes with keys in this environment, used to tell which DOKU host a webhook came from. */
export const configuredModes = () =>
  (['development', 'production'] as const).filter((mode) => credentialsFor(mode) !== null)

export function dokuEnabled() {
  const mode = gatewayMode()
  return mode !== null && credentialsFor(mode) !== null
}

const apiBase = (mode: GatewayMode) =>
  mode === 'production' ? 'https://api.doku.com' : 'https://api-sandbox.doku.com'

/** Public origin for notify/return URLs. */
export function appOrigin(): string {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
}

// DOKU rejects the whole request if free text has characters outside this set.
export const sanitize = (value: string) =>
  value
    .replace(/[^a-zA-Z0-9 .\-/+,=_:'@%()]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

export const digestOf = (rawBody: string) => createHash('sha256').update(rawBody).digest('base64')

/** DOKU's request signature: signs outgoing calls and verifies incoming notifications. */
export function signature(
  parts: { clientId: string; requestId: string; requestTimestamp: string; requestTarget: string; digest?: string },
  secretKey: string,
) {
  let payload =
    `Client-Id:${parts.clientId}\n` +
    `Request-Id:${parts.requestId}\n` +
    `Request-Timestamp:${parts.requestTimestamp}\n` +
    `Request-Target:${parts.requestTarget}`
  if (parts.digest) payload += `\nDigest:${parts.digest}`
  return `HMACSHA256=${createHmac('sha256', secretKey).update(payload).digest('base64')}`
}

export class DokuError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function request<T>(method: 'GET' | 'POST', path: string, mode: GatewayMode, body?: unknown): Promise<T> {
  const credentials = credentialsFor(mode)
  if (!credentials) throw new Error(`No DOKU keys for PAYMENT_GATEWAY_MODE=${mode}.`)
  const requestId = randomUUID()
  // DOKU expects second precision ("2020-08-11T08:45:42Z").
  const requestTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const rawBody = body === undefined ? undefined : JSON.stringify(body)

  const response = await fetch(`${apiBase(mode)}${path}`, {
    method,
    headers: {
      'Client-Id': credentials.clientId,
      'Request-Id': requestId,
      'Request-Timestamp': requestTimestamp,
      Signature: signature(
        {
          clientId: credentials.clientId,
          requestId,
          requestTimestamp,
          requestTarget: path,
          digest: rawBody === undefined ? undefined : digestOf(rawBody),
        },
        credentials.secretKey,
      ),
      ...(rawBody === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(rawBody === undefined ? {} : { body: rawBody }),
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new DokuError(`DOKU ${method} ${path} failed (${response.status}): ${await response.text()}`, response.status)
  }
  return response.json() as Promise<T>
}

const isPublic = (url: string) => url.startsWith('https://')

export interface CheckoutInput {
  invoiceNumber: string
  amount: number
  itemName: string
  category: string
  paymentMethodTypes: string[]
  dueMinutes: number
  customerName: string
  customerPhone?: string | null
  customerEmail?: string | null
  /** Where DOKU's "back to merchant" button sends the payer. */
  returnUrl: string
}

export async function createCheckout(mode: GatewayMode, input: CheckoutInput) {
  const notificationUrl = `${appOrigin()}${DOKU_NOTIFICATION_PATH}`
  const phone = input.customerPhone?.replace(/\D/g, '') || undefined
  const result = await request<{
    response: { order: { invoice_number: string }; payment: { url: string; expired_date?: string } }
  }>('POST', CHECKOUT_PATH, mode, {
    order: {
      amount: input.amount,
      invoice_number: input.invoiceNumber,
      currency: 'IDR',
      callback_url: input.returnUrl,
      callback_url_result: input.returnUrl,
      line_items: [
        { id: '1', name: sanitize(input.itemName).slice(0, 255) || 'Pembayaran', quantity: 1, price: input.amount, category: sanitize(input.category) },
      ],
    },
    payment: {
      payment_due_date: input.dueMinutes,
      payment_method_types: input.paymentMethodTypes,
    },
    customer: {
      name: sanitize(input.customerName).slice(0, 255) || 'Pasien',
      ...(input.customerEmail ? { email: input.customerEmail } : {}),
      ...(phone ? { phone } : {}),
    },
    // Sent per request so each deployment gets its own notifications (and the
    // shared merchant's other sites keep theirs). DOKU can't reach localhost —
    // local links settle by polling the status API instead.
    ...(isPublic(notificationUrl) ? { additional_info: { override_notification_url: notificationUrl } } : {}),
  })
  return { invoiceNumber: result.response.order.invoice_number, url: result.response.payment.url }
}

export type OrderStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED'

export interface DokuOrderResponse {
  order?: { invoice_number?: string; amount?: number | string; status?: string }
  transaction?: { status?: string; date?: string; original_request_id?: string }
  channel?: { id?: string }
  acquirer?: { id?: string }
  virtual_account_info?: { virtual_account_number?: string }
  [key: string]: unknown
}

export interface NormalizedOrder {
  status: OrderStatus
  amount: number
  channel: string | null
  reference: string | null
  paidAt: string | null
  raw: DokuOrderResponse
}

/**
 * DOKU order → PENDING / PAID / EXPIRED. Pure, so it is unit-tested.
 * FAILED / TIMEOUT attempts are retryable on the same page until the link's own
 * expiry, so they stay PENDING; `expiresAt` (ours) is authoritative because the
 * sandbox status API keeps reporting abandoned orders as PENDING forever.
 */
export function normalizeOrder(raw: DokuOrderResponse, expiresAt: Date | null, now = new Date()): NormalizedOrder {
  const tx = raw.transaction?.status?.toUpperCase()
  let status: OrderStatus = 'PENDING'
  if (tx === 'SUCCESS') status = 'PAID'
  else if (tx === 'EXPIRED' || raw.order?.status?.toUpperCase() === 'ORDER_EXPIRED') status = 'EXPIRED'
  else if (expiresAt && now.getTime() > expiresAt.getTime() + 10 * 60_000) status = 'EXPIRED'

  const reference =
    raw.virtual_account_info?.virtual_account_number ||
    raw.transaction?.original_request_id ||
    null

  return {
    status,
    amount: Number(raw.order?.amount ?? 0),
    channel: raw.channel?.id ?? null,
    reference,
    paidAt: status === 'PAID' ? (raw.transaction?.date ?? now.toISOString()) : null,
    raw,
  }
}

/** Raw order status from DOKU. A 404 means DOKU has no payment attempt yet. */
export async function getOrder(mode: GatewayMode, invoiceNumber: string): Promise<DokuOrderResponse | null> {
  try {
    return await request<DokuOrderResponse>('GET', `${STATUS_PATH}/${encodeURIComponent(invoiceNumber)}`, mode)
  } catch (error) {
    if (error instanceof DokuError && error.status === 404) return null
    throw error
  }
}

export interface NotificationHeaders {
  clientId: string | null
  requestId: string | null
  requestTimestamp: string | null
  signature: string | null
}

/**
 * Checks a notification's signature against one mode's secret key. No
 * timestamp-freshness window: DOKU retries reuse delivery headers, and a
 * replayed notification is harmless since settlement re-fetches status from DOKU.
 */
export function validNotification(headers: NotificationHeaders, rawBody: string, mode: GatewayMode) {
  const credentials = credentialsFor(mode)
  const { clientId, requestId, requestTimestamp } = headers
  if (!credentials || !clientId || !requestId || !requestTimestamp || !headers.signature) return false
  if (clientId !== credentials.clientId) return false
  const expected = Buffer.from(
    signature(
      { clientId, requestId, requestTimestamp, requestTarget: DOKU_NOTIFICATION_PATH, digest: digestOf(rawBody) },
      credentials.secretKey,
    ),
  )
  const received = Buffer.from(headers.signature)
  return received.length === expected.length && timingSafeEqual(received, expected)
}
