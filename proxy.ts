import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { navigation } from '@/config/navigation'
import { buildOverrideMap, isPathAllowed } from '@/lib/pagePermissions'
import type { UserRole } from '@/types'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip auth check if Supabase env vars are not configured yet
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
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

  const { data: { user } } = await supabase.auth.getUser()
  const isPublic = pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/unauthorized') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/resume/')

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (pathname === '/login' || pathname === '/register' || pathname === '/' || pathname === '/dashboard')) {
    const { data: profile } = await supabase
      .from('internal_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

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
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // Route-level role guard — prevents unauthorized URL access regardless of navigation
  if (user && !isPublic) {
    const { data: profile } = await supabase
      .from('internal_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Unapproved users can only ever sit on the pending screen
    if (pathname !== '/pending' && profile?.role === 'non-staff') {
      return NextResponse.redirect(new URL('/pending', request.url))
    }

    // Route-level role guard, driven by config/navigation.ts's coded default
    // roles plus any director overrides in role_page_permissions. Covers
    // every nav-registered page (not just a hardcoded prefix list). A
    // missing profile row is left alone here (handled by the dashboard
    // layout's transient fallback) rather than redirected, matching prior
    // behavior.
    if (profile && profile.role !== 'non-staff') {
      const { data: overrideRows } = await supabase
        .from('role_page_permissions')
        .select('page_key, role, allowed')
      const overrides = buildOverrideMap(overrideRows ?? [])
      if (!isPathAllowed(pathname, profile.role as UserRole, navigation, overrides)) {
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
