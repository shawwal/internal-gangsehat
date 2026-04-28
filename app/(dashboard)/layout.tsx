import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import type { UserRole } from '@/types'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Only redirect to login if truly unauthenticated — never redirect an
  // authenticated user back to /login (causes a 307 loop with proxy.ts)
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('id, full_name, email, role, branch_id, avatar_url')
    .eq('id', user.id)
    .single()

  // If the profile row doesn't exist yet (e.g. schema not migrated, or first
  // login before trigger fires), use a safe in-memory fallback so the layout
  // renders instead of looping back through /login → proxy → here.
  const resolved = profile ?? {
    id:         user.id,
    full_name:  user.email?.split('@')[0] ?? 'User',
    email:      user.email ?? '',
    role:       'director' as UserRole,
    branch_id:  null,
    avatar_url: null,
  }

  return (
    <DashboardShell
      profile={resolved as {
        id: string
        full_name: string
        email: string
        role: UserRole
        branch_id: string | null
        avatar_url: string | null
      }}
    >
      {children}
    </DashboardShell>
  )
}
