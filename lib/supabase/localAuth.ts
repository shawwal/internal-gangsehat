import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * Egress/log saver: make `supabase.auth.getUser()` (no-arg form) verify the
 * session JWT locally via `getClaims()` instead of a round-trip to Supabase
 * Auth on every server request. The project signs JWTs with ES256, so the
 * JWKS is fetched once and cached; verification is pure CPU.
 *
 * Trade-off: a revoked/banned session stays valid until its access token
 * expires (≤ 1h). Data access is still enforced by RLS on every query.
 * Call `getUser(jwt)` explicitly when an authoritative server check is needed.
 */
export function withLocalAuth<T extends SupabaseClient>(client: T): T {
  const auth = client.auth as typeof client.auth & { __localAuth?: true }
  // createBrowserClient returns a singleton — patch it only once.
  if (auth.__localAuth) return client
  auth.__localAuth = true
  const original = auth.getUser.bind(auth)
  auth.getUser = (async (jwt?: string) => {
    if (jwt) return original(jwt)
    const { data, error } = await auth.getClaims()
    if (error || !data?.claims?.sub) {
      return { data: { user: null }, error: error ?? null } as Awaited<ReturnType<typeof original>>
    }
    const c = data.claims as Record<string, unknown>
    const user = {
      id: c.sub as string,
      aud: (c.aud as string) ?? 'authenticated',
      role: (c.role as string) ?? 'authenticated',
      email: c.email as string | undefined,
      phone: c.phone as string | undefined,
      app_metadata: (c.app_metadata as User['app_metadata']) ?? {},
      user_metadata: (c.user_metadata as User['user_metadata']) ?? {},
      is_anonymous: Boolean(c.is_anonymous),
      created_at: '',
    } as User
    return { data: { user }, error: null } as Awaited<ReturnType<typeof original>>
  }) as typeof auth.getUser
  return client
}
