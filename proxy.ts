import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { navigation } from '@/config/navigation'
import { buildOverrideMap, isPathAllowed } from '@/lib/pagePermissions'
import { GRIYA_THERAPIST_HOME, isGriyaTherapist, isPathAllowedForGriyaTherapist } from '@/lib/griyaTherapist'
import type { UserRole } from '@/types'
import { PROXY_AUTH_COOKIE, TTL_SECONDS, readCtx, signCtx, type ProxyAuthCtx } from '@/lib/proxyAuthCache'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip auth check if Supabase env vars are not configured yet
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return NextResponse.next({ request })
  }

  // DOKU server-to-server notifications carry no session; the route verifies
  // DOKU's HMAC signature itself.
  if (pathname === '/api/payments/doku/notify') {
    return NextResponse.next({ request })
  }

  // gangsehat.com server-to-server API; each route verifies the HMAC
  // signature (lib/onlineBooking/auth.ts).
  if (pathname.startsWith('/api/public/')) {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Verify the session JWT locally (ES256 JWKS, cached) — no Auth round-trip.
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub as string } : null

  // Role context (profile + Griya flag + page overrides), cached in a signed
  // cookie for TTL_SECONDS so most requests do zero DB queries here.
  let ctxPromise: Promise<ProxyAuthCtx> | null = null
  const loadCtx = (uid: string) => (ctxPromise ??= (async () => {
    const cached = await readCtx(request.cookies.get(PROXY_AUTH_COOKIE)?.value, uid)
    if (cached) return cached
    const { data: profile } = await supabase
      .from('internal_profiles').select('role, additional_roles, branch_id').eq('id', uid).maybeSingle()
    let griya = false
    if (profile?.role === 'therapist' && profile.branch_id) {
      const { data } = await supabase
        .from('branch_griya_settings').select('enabled').eq('branch_id', profile.branch_id).maybeSingle()
      griya = data?.enabled ?? false
    }
    let ov: [string, boolean][] = []
    if (profile && profile.role !== 'non-staff') {
      const { data: rows } = await supabase
        .from('role_page_permissions').select('page_key, role, allowed').in('role', [profile.role, ...(profile.additional_roles ?? [])])
      ov = [...buildOverrideMap(rows ?? []).entries()]
    }
    const ctx = { uid, role: profile?.role ?? null, extra: (profile?.additional_roles ?? []) as string[], branch_id: profile?.branch_id ?? null, griya, ov }
    // Don't cache a missing profile (first login before the trigger fires).
    if (profile) {
      const signed = await signCtx(ctx)
      if (signed) pendingCookie = signed
    }
    return { ...ctx, exp: 0 }
  })())
  let pendingCookie: string | null = null
  const finish = (res: NextResponse) => {
    if (pendingCookie) {
      res.cookies.set(PROXY_AUTH_COOKIE, pendingCookie, {
        httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: TTL_SECONDS,
      })
    }
    return res
  }
  const isPublic = pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/unauthorized') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/resume/')

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (pathname === '/login' || pathname === '/register' || pathname === '/' || pathname === '/dashboard')) {
    const ctx = await loadCtx(user.id)
    const profile = ctx.role ? ctx : null

    if (profile?.role === 'therapist' && profile.branch_id) {
      if (isGriyaTherapist(profile.role, ctx.griya)) {
        return finish(NextResponse.redirect(new URL(GRIYA_THERAPIST_HOME, request.url)))
      }
    }

    const roleHome: Record<string, string> = {
      director:   '/director/overview',
      finance:    '/finance/transactions',
      hr:         '/hr/staff',
      marketing:  '/marketing/campaigns',
      manager:    '/patients',
      therapist:  '/patients',
      staff:      '/patients',
      admin:      '/jadwal-harian',
      'non-staff': '/pending',
      sport_massage_therapist: '/jadwal-sport-massage',
    }
    const dest = roleHome[profile?.role ?? ''] ?? '/director/overview'
    return finish(NextResponse.redirect(new URL(dest, request.url)))
  }

  // Route-level role guard — prevents unauthorized URL access regardless of navigation
  if (user && !isPublic) {
    const ctx = await loadCtx(user.id)
    const profile = ctx.role ? ctx : null

    // Unapproved users can only ever sit on the pending screen
    if (pathname !== '/pending' && profile?.role === 'non-staff') {
      return finish(NextResponse.redirect(new URL('/pending', request.url)))
    }

    // Route-level role guard, driven by config/navigation.ts's coded default
    // roles plus any director overrides in role_page_permissions. Covers
    // every nav-registered page (not just a hardcoded prefix list). A
    // missing profile row is left alone here (handled by the dashboard
    // layout's transient fallback) rather than redirected, matching prior
    // behavior.
    // Therapists of a Griya Anak branch only get the Griya Anak workspace.
    if (profile?.role === 'therapist' && profile.branch_id) {
      if (isGriyaTherapist(profile.role, ctx.griya) &&
          !isPathAllowedForGriyaTherapist(pathname, navigation)) {
        return finish(NextResponse.redirect(new URL(GRIYA_THERAPIST_HOME, request.url)))
      }
    }

    if (profile && profile.role !== 'non-staff') {
      const overrides = new Map(ctx.ov)
      if (!isPathAllowed(pathname, profile.role as UserRole, navigation, overrides, (ctx.extra ?? []) as UserRole[])) {
        return finish(NextResponse.redirect(new URL('/unauthorized', request.url)))
      }
    }
  }

  return finish(response)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)'],
}
