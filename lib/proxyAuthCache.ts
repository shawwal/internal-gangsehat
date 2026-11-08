/**
 * Short-lived signed cookie caching what proxy.ts needs for its role guard
 * (role, branch, Griya flag, page-permission overrides for that role), so the
 * proxy stops hitting the database on every request / server action.
 * HMAC-SHA256 (Web Crypto) keyed by a server secret — tamper-proof.
 * Stale for at most TTL_SECONDS after a role/permission change.
 */
export const PROXY_AUTH_COOKIE = 'gs_auth_ctx'
export const TTL_SECONDS = 300

export type ProxyAuthCtx = {
  uid: string
  role: string | null
  branch_id: string | null
  griya: boolean
  ov: [string, boolean][]   // override map entries, filtered to this role
  exp: number
}

const enc = new TextEncoder()
let keyPromise: Promise<CryptoKey> | null = null
function key() {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ENCRYPTION_KEY
  if (!secret) return null
  keyPromise ??= crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
  return keyPromise
}

const b64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

export async function signCtx(ctx: Omit<ProxyAuthCtx, 'exp'>): Promise<string | null> {
  const k = await key()
  if (!k) return null
  const body = b64(enc.encode(JSON.stringify({ ...ctx, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS })))
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(body))
  return `${body}.${b64(sig)}`
}

export async function readCtx(value: string | undefined, uid: string): Promise<ProxyAuthCtx | null> {
  if (!value) return null
  const k = await key()
  if (!k) return null
  const [body, sig] = value.split('.')
  if (!body || !sig) return null
  try {
    const ok = await crypto.subtle.verify('HMAC', k, unb64(sig), enc.encode(body))
    if (!ok) return null
    const ctx = JSON.parse(new TextDecoder().decode(unb64(body))) as ProxyAuthCtx
    if (ctx.uid !== uid || ctx.exp < Date.now() / 1000) return null
    return ctx
  } catch {
    return null
  }
}
