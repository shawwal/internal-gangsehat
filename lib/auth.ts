import { redirect } from 'next/navigation'
import { SupabaseClient } from '@supabase/supabase-js'

export type UserRole = 'director' | 'finance' | 'hr' | 'marketing'

export async function requireRole(supabase: SupabaseClient, allowed: UserRole[]) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role, branch_id, full_name, avatar_url')
    .eq('id', user.id)
    .single()

  if (!profile || !allowed.includes(profile.role as UserRole)) {
    redirect('/unauthorized')
  }
  return profile
}

export async function getProfileOrNull(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('id, role, branch_id, full_name, avatar_url, email, phone, is_active')
    .eq('id', user.id)
    .single()

  return profile
}

export function roleDashboard(role: UserRole): string {
  switch (role) {
    case 'director':  return '/director/overview'
    case 'finance':   return '/finance/transactions'
    case 'hr':        return '/hr/staff'
    case 'marketing': return '/marketing/campaigns'
  }
}
