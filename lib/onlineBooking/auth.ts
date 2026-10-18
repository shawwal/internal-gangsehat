import { createHmac, timingSafeEqual } from 'crypto'

// Server-to-server auth for /api/public/* (called by gangsehat.com server
// actions, never by browsers). Signature = hex HMAC-SHA256 of
// `${timestamp}.${rawBody}` with GS_API_SECRET, sent as X-GS-Signature
// with X-GS-Timestamp (unix seconds). The same signer lives in the gangsehat
// repo at lib/internal-api.ts — keep both in sync.

export const MAX_SKEW_SECONDS = 300

export function signPublicRequest(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

export function verifyPublicRequest(
  secret: string | undefined,
  timestamp: string | null,
  signature: string | null,
  body: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !timestamp || !signature) return false
  const ts = Number(timestamp)
  if (!Number.isInteger(ts) || Math.abs(nowSeconds - ts) > MAX_SKEW_SECONDS) return false
  const expected = Buffer.from(signPublicRequest(secret, timestamp, body), 'hex')
  const given = Buffer.from(signature, 'hex')
  return expected.length === given.length && timingSafeEqual(expected, given)
}
