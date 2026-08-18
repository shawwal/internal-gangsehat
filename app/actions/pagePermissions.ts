'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activityLog'
import { navigation } from '@/config/navigation'
import type { UserRole } from '@/types'

type RequireDirectorResult =
  | { error: string }
  | { supabase: Awaited<ReturnType<typeof createClient>>; userId: string }

async function requireDirector(): Promise<RequireDirectorResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const { data: caller } = await supabase
    .from('internal_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'director') return { error: 'Akses ditolak.' }
  return { supabase, userId: user.id }
}

export interface PagePermissionRow {
  page_key: string
  role: string
  allowed: boolean
}

export interface PageRegistryRow {
  key: string
  label: string
  href: string
  group: string
  defaultRoles: UserRole[]
}

/** Every page in the nav registry with its coded default roles and any director overrides. */
export async function getPagePermissions(): Promise<
  { error: string } | { pages: PageRegistryRow[]; overrides: PagePermissionRow[] }
> {
  const result = await requireDirector()
  if ('error' in result) return { error: result.error }
  const { supabase } = result

  const { data: overrides, error } = await supabase
    .from('role_page_permissions')
    .select('page_key, role, allowed')
  if (error) return { error: error.message ?? 'Terjadi kesalahan.' }

  return {
    pages: navigation.filter((item) => item.href).map((item) => ({
      key: item.key,
      label: item.label,
      href: item.href!,
      group: item.group,
      defaultRoles: item.roles,
    })),
    overrides: (overrides ?? []) as PagePermissionRow[],
  }
}

const CONTROLLABLE_ROLES: UserRole[] = [
  'finance', 'hr', 'marketing', 'staff', 'therapist', 'manager', 'admin', 'sport_massage_therapist',
]

export async function setPagePermission(
  pageKey: string, role: UserRole, allowed: boolean
): Promise<{ error: string } | { success: true }> {
  if (!CONTROLLABLE_ROLES.includes(role)) return { error: 'Role tidak dapat diatur.' }

  const result = await requireDirector()
  if ('error' in result) return { error: result.error }
  const { supabase, userId } = result

  const item = navigation.find((i) => i.key === pageKey)
  if (!item) return { error: 'Halaman tidak ditemukan.' }

  const { error } = await supabase
    .from('role_page_permissions')
    .upsert(
      { page_key: pageKey, role, allowed, updated_by: userId, updated_at: new Date().toISOString() },
      { onConflict: 'page_key,role' }
    )
  if (error) return { error: error.message ?? 'Terjadi kesalahan.' }

  logActivity({
    supabase, userId, action: 'update', resourceType: 'role_page_permission',
    resourceId: `${pageKey}:${role}`, resourceLabel: `${item.label} — ${role}`,
    oldValues: null, newValues: { allowed },
  })

  revalidatePath('/', 'layout')
  return { success: true }
}

/** Removes an override, reverting the page/role pair back to its coded default. */
export async function resetPagePermission(
  pageKey: string, role: UserRole
): Promise<{ error: string } | { success: true }> {
  const result = await requireDirector()
  if ('error' in result) return { error: result.error }
  const { supabase, userId } = result

  const item = navigation.find((i) => i.key === pageKey)

  const { error } = await supabase
    .from('role_page_permissions')
    .delete()
    .eq('page_key', pageKey)
    .eq('role', role)
  if (error) return { error: error.message ?? 'Terjadi kesalahan.' }

  logActivity({
    supabase, userId, action: 'delete', resourceType: 'role_page_permission',
    resourceId: `${pageKey}:${role}`, resourceLabel: item ? `${item.label} — ${role}` : pageKey,
  })

  revalidatePath('/', 'layout')
  return { success: true }
}
