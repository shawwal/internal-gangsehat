'use client'

import { useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { navForKeys } from '@/config/navigation'
import type { NavGroup, NavItem } from '@/config/navigation'
import { useSportMassageSettings } from '@/hooks/useSportMassageSettings'
import { useGriyaSettings } from '@/hooks/useGriyaSettings'

/**
 * Single source of truth for the dashboard nav: takes the role-allowed nav keys
 * and the caller's branch, then applies the branch feature-gating (Griya Anak,
 * Sport Massage) and grouping used by the desktop sidebar, the mobile drawer and
 * the bottom tab bar so all three stay in sync.
 *
 * Director (`branchId === null`) sees every feature.
 */
export function useNavItems(allowedNavKeys: string[], branchId: string | null) {
  const pathname = usePathname()

  const branchIds = useMemo(() => (branchId ? [branchId] : []), [branchId])
  const { enabledMap: sportMassageMap } = useSportMassageSettings(branchIds)
  const { enabledMap: griyaMap }         = useGriyaSettings(branchIds)

  const isDirector = !branchId
  const sportMassageEnabled = isDirector ? true : (sportMassageMap[branchId!] ?? false)
  const griyaEnabled        = isDirector ? true : (griyaMap[branchId!] ?? false)

  const items = useMemo(
    () =>
      navForKeys(allowedNavKeys).filter(
        (i) =>
          (i.key !== 'jadwal-sport-massage' || sportMassageEnabled) &&
          (!i.key.startsWith('griya-') || griyaEnabled),
      ),
    [allowedNavKeys, sportMassageEnabled, griyaEnabled],
  )

  const orderedGroupKeys = useMemo(
    () => [...new Set(items.map((i) => i.group))] as NavGroup[],
    [items],
  )

  const groupedItems = useMemo(
    () =>
      orderedGroupKeys.reduce<Record<NavGroup, NavItem[]>>((acc, g) => {
        acc[g] = items.filter((i) => i.group === g)
        return acc
      }, {} as Record<NavGroup, NavItem[]>),
    [orderedGroupKeys, items],
  )

  const isActive = useCallback(
    (href?: string) => {
      if (!href) return false
      if (href === '/') return pathname === '/'
      const isParent = items.some(
        (i) => i.href && i.href !== href && i.href.startsWith(href + '/'),
      )
      if (isParent) return pathname === href
      return pathname === href || pathname.startsWith(href + '/')
    },
    [items, pathname],
  )

  return { items, orderedGroupKeys, groupedItems, isActive }
}
