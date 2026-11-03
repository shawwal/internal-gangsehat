import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { GRIYA_BRANCH_COOKIE, GRIYA_BRANCH_HEADER, parseGriyaBranch } from '@/lib/griyaBranch'

export async function createClient() {
  const cookieStore = await cookies()
  // Only sent on /griya-anak requests (cookie path) — see lib/griyaBranch.ts.
  const griyaBranch = parseGriyaBranch(cookieStore.get(GRIYA_BRANCH_COOKIE)?.value)

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      ...(griyaBranch && { global: { headers: { [GRIYA_BRANCH_HEADER]: griyaBranch } } }),
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component — cookies can't be set
          }
        },
      },
    }
  )
}
