'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import * as Icons from 'lucide-react'
import { ChevronDown, Search } from 'lucide-react'
import { NAV_GROUP_LABELS } from '@/config/navigation'
import type { NavGroup } from '@/config/navigation'
import type { UserRole } from '@/types'
import { useNavItems } from '@/hooks/useNavItems'

const COLLAPSED_GROUPS_KEY = 'gs_nav_collapsed_groups'

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LucideIcon = (Icons as any)[name]
  if (!LucideIcon) return null
  return <LucideIcon size={size} />
}

interface Props {
  role: UserRole
  branchId: string | null
  allowedNavKeys: string[]
  collapsed: boolean
}

export function Sidebar({ role, branchId, allowedNavKeys, collapsed }: Props) {
  const { items, orderedGroupKeys, groupedItems, isActive } = useNavItems(allowedNavKeys, branchId)

  const [search, setSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<NavGroup>>(new Set())

  // Hydrate persisted accordion state after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_GROUPS_KEY)
      if (raw) setCollapsedGroups(new Set(JSON.parse(raw) as NavGroup[]))
    } catch { /* ignore */ }
  }, [])

  function toggleGroup(group: NavGroup) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      try {
        localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...next]))
      } catch { /* ignore */ }
      return next
    })
  }

  // The group that owns the current route stays expanded regardless of stored state
  const activeGroup = useMemo(
    () => items.find((i) => isActive(i.href))?.group ?? null,
    [items, isActive],
  )

  const query = search.trim().toLowerCase()
  const searchResults = query ? items.filter((i) => i.label.toLowerCase().includes(query)) : []

  return (
    <aside
      className={`flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-[220px]'
      }`}
    >
      {/* Logo */}
      <div
        className={`flex items-center h-14 border-b border-sidebar-border shrink-0 ${
          collapsed ? 'justify-center px-2' : 'px-4'
        }`}
      >
        {collapsed ? (
          <>
            <Image src="/black-logo.png" alt="GS" width={28} height={28} className="object-contain dark:hidden" priority />
            <Image src="/white-logo.png" alt="GS" width={28} height={28} className="object-contain hidden dark:block" priority />
          </>
        ) : (
          <>
            <Image src="/black-logo.png" alt="Gang Sehat" width={140} height={40} className="object-contain dark:hidden" priority />
            <Image src="/white-logo.png" alt="Gang Sehat" width={140} height={40} className="object-contain hidden dark:block" priority />
          </>
        )}
      </div>

      {/* Search — expanded sidebar only */}
      {!collapsed && (
        <div className="px-3 pt-3 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-foreground/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari menu..."
              className="w-full pl-8 pr-3 py-2 rounded-xl text-sm bg-muted/50 border border-sidebar-border focus:outline-none focus:border-primary/40 text-foreground/80 placeholder:text-foreground/30"
            />
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-sidebar">
        {!collapsed && query ? (
          /* Flat search results */
          <div className="space-y-0.5">
            {searchResults.length > 0 ? (
              searchResults.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.key}
                    href={item.href!}
                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-foreground/60 hover:text-foreground hover:bg-muted dark:text-foreground/50 dark:hover:text-foreground'
                    }`}
                  >
                    <span className="shrink-0"><Icon name={item.icon} /></span>
                    <span>{item.label}</span>
                  </Link>
                )
              })
            ) : (
              <p className="text-center text-sm py-8 text-foreground/40">
                Tidak ada menu yang cocok dengan &ldquo;{search.trim()}&rdquo;
              </p>
            )}
          </div>
        ) : (
          orderedGroupKeys.map((groupKey, gi) => {
            const isGroupCollapsed =
              !collapsed && groupKey !== activeGroup && collapsedGroups.has(groupKey)
            return (
              <div key={groupKey} className={gi > 0 ? 'mt-4' : ''}>
                {/* Group header */}
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupKey)}
                    className="w-full flex items-center justify-between px-3 mb-1 text-[10px] font-semibold tracking-widest uppercase text-foreground/30 hover:text-foreground/60 transition-colors"
                  >
                    <span>{NAV_GROUP_LABELS[groupKey]}</span>
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${isGroupCollapsed ? '-rotate-90' : ''}`}
                    />
                  </button>
                )}
                {collapsed && gi > 0 && <div className="mx-3 my-2 h-px bg-sidebar-border" />}

                {!isGroupCollapsed && (
                  <div className="space-y-0.5">
                    {groupedItems[groupKey].map((item) => {
                      const active = isActive(item.href)
                      return (
                        <Link
                          key={item.key}
                          href={item.href!}
                          title={collapsed ? item.label : undefined}
                          className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                            collapsed ? 'justify-center' : ''
                          } ${
                            active
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-foreground/60 hover:text-foreground hover:bg-muted dark:text-foreground/50 dark:hover:text-foreground'
                          }`}
                        >
                          <span className="shrink-0"><Icon name={item.icon} /></span>
                          {!collapsed && <span>{item.label}</span>}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </nav>

      {/* Role badge */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-sidebar-border shrink-0">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
            {role}
          </span>
        </div>
      )}
    </aside>
  )
}
