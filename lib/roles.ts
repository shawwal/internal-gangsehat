import type { UserRole } from '@/types'

// Primary role + additional work roles (migration 132). `role` alone drives
// RLS, home redirect and access level; `additional_roles` only widens where a
// person appears (jadwal columns, therapist pickers, payroll rosters) and which
// pages they can open.

/** Work roles that may be added on top of the primary role. */
export const ADDITIONAL_ROLE_OPTIONS: UserRole[] = ['therapist', 'sport_massage_therapist', 'staff']

export interface RoleCarrier {
  role?: string | null
  additional_roles?: string[] | null
}

export function profileRoles(p: RoleCarrier | null | undefined): string[] {
  if (!p) return []
  return [...new Set([p.role ?? '', ...(p.additional_roles ?? [])].filter(Boolean))]
}

export function hasRole(p: RoleCarrier | null | undefined, ...roles: string[]): boolean {
  const mine = profileRoles(p)
  return roles.some((r) => mine.includes(r))
}

/**
 * PostgREST `.or()` filter: primary role OR additional role in `roles`.
 * On an embedded table pass `{ referencedTable: 'internal_profiles' }`.
 */
export function roleOrFilter(roles: string[]): string {
  return [
    `role.in.(${roles.join(',')})`,
    ...roles.map((r) => `additional_roles.cs.{${r}}`),
  ].join(',')
}
