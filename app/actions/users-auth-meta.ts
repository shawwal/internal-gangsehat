'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface UserAuthMeta {
  /** ISO timestamp of the user's most recent sign-in, or null if they have never signed in. */
  lastSignInAt: string | null
  /** Auth providers linked to the account, e.g. ['email'], ['google'], ['email', 'google']. */
  providers: string[]
}

/**
 * Returns auth metadata (last sign-in + linked providers) for every internal user.
 * Restricted to director / manager — the same roles allowed to manage users.
 */
export async function getUsersAuthMeta(): Promise<{
  data: Record<string, UserAuthMeta>
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: {}, error: 'Tidak terautentikasi.' }

  const { data: caller } = await supabase
    .from('internal_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'director' && caller?.role !== 'manager') {
    return { data: {}, error: 'Akses ditolak.' }
  }

  const admin = createAdminClient()
  const map: Record<string, UserAuthMeta> = {}

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) return { data: map, error: error.message }

    for (const u of data.users) {
      const providers = (u.identities ?? []).map((i) => i.provider)
      map[u.id] = {
        lastSignInAt: u.last_sign_in_at ?? null,
        providers: providers.length ? providers : (u.app_metadata?.providers as string[] | undefined) ?? [],
      }
    }

    if (data.users.length < 1000) break
  }

  return { data: map, error: null }
}
