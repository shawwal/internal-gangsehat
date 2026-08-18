import type { NavItem } from '@/config/navigation'
import type { UserRole } from '@/types'

/** `${pageKey}:${role}` → allowed, built from role_page_permissions rows. */
export type PermissionOverrides = Map<string, boolean>

export function buildOverrideMap(rows: { page_key: string; role: string; allowed: boolean }[]): PermissionOverrides {
  const map: PermissionOverrides = new Map()
  for (const row of rows) map.set(`${row.page_key}:${row.role}`, row.allowed)
  return map
}

/** Director always has full access — never subject to overrides, can never be locked out. */
export function isAllowed(role: UserRole, item: NavItem, overrides: PermissionOverrides): boolean {
  if (role === 'director') return true
  const override = overrides.get(`${item.key}:${role}`)
  if (override !== undefined) return override
  return item.roles.includes(role)
}

/**
 * Finds the nav item(s) governing a given pathname. Matches on href being an
 * exact match or a path-segment prefix of pathname, then narrows to the
 * longest (most specific) href among matches — this both prefers a nested
 * page's own entry over a parent's, and correctly groups same-href
 * duplicate entries (different roles, same page) together.
 */
export function matchNavItems(pathname: string, nav: NavItem[]): NavItem[] {
  const matched = nav.filter(
    (item) => item.href && (pathname === item.href || pathname.startsWith(item.href + '/'))
  )
  if (matched.length === 0) return []
  const maxLen = Math.max(...matched.map((item) => item.href!.length))
  return matched.filter((item) => item.href!.length === maxLen)
}

/** True if `role` may access `pathname`, given the current nav registry + overrides. */
export function isPathAllowed(
  pathname: string,
  role: UserRole,
  nav: NavItem[],
  overrides: PermissionOverrides
): boolean {
  if (role === 'director') return true
  const matched = matchNavItems(pathname, nav)
  if (matched.length === 0) return true // not a registered page — unchanged legacy behavior
  return matched.some((item) => isAllowed(role, item, overrides))
}

/** Every nav key `role` can currently reach, given the current overrides. Used to filter the sidebar/tab bar/drawer. */
export function allowedNavKeysForRole(role: UserRole, nav: NavItem[], overrides: PermissionOverrides): string[] {
  return nav.filter((item) => isAllowed(role, item, overrides)).map((item) => item.key)
}
