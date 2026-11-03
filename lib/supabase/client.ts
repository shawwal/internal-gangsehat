import { createBrowserClient } from '@supabase/ssr'
import { GRIYA_BRANCH_HEADER, readGriyaBranchCookie } from '@/lib/griyaBranch'

// On /griya-anak, database requests carry the picked Griya branch (lib/griyaBranch.ts).
function griyaFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const branch = readGriyaBranchCookie()
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (!branch || !url.includes('/rest/v1/')) return fetch(input, init)
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
  headers.set(GRIYA_BRANCH_HEADER, branch)
  return fetch(input, { ...init, headers })
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { global: { fetch: griyaFetch } }
  )
}
