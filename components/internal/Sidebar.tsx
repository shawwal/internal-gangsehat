'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as LucideIcons from 'lucide-react'
import { navigation } from '@/config/navigation'
import type { NavItem } from '@/config/navigation'

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LucideIcon = (LucideIcons as any)[name]
  if (!LucideIcon) return null
  return <LucideIcon size={size} />
}

interface Props {
  collapsed: boolean
}

export function Sidebar({ collapsed }: Props) {
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    const active = new Set<string>()
    navigation.forEach((item) => {
      if (item.children?.some((c) => c.href && pathname.startsWith(c.href))) {
        active.add(item.key)
      }
    })
    setOpenGroups(active)
  }, [pathname])

  function toggleGroup(key: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function isActive(href?: string) {
    if (!href) return false
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  }

  function renderItem(item: NavItem, depth = 0) {
    if (item.children) {
      const open = openGroups.has(item.key)
      return (
        <div key={item.key}>
          <button
            onClick={() => toggleGroup(item.key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${
              collapsed ? 'justify-center' : ''
            } hover:bg-muted text-sidebar-foreground/60 hover:text-sidebar-foreground`}
          >
            <span className="shrink-0"><Icon name={item.icon} /></span>
            {!collapsed && (
              <>
                <span className="flex-1 text-sm font-medium">{item.label}</span>
                <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={14} />
              </>
            )}
          </button>
          {!collapsed && open && (
            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-3">
              {item.children.map((child) => renderItem(child, depth + 1))}
            </div>
          )}
        </div>
      )
    }

    return (
      <Link
        key={item.key}
        href={item.href!}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
          collapsed ? 'justify-center' : ''
        } ${
          isActive(item.href)
            ? 'bg-primary text-primary-foreground'
            : 'text-sidebar-foreground/60 hover:bg-muted hover:text-sidebar-foreground'
        }`}
      >
        <span className="shrink-0"><Icon name={item.icon} /></span>
        {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
      </Link>
    )
  }

  return (
    <aside
      className={`flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-[220px]'
      }`}
    >
      <div
        className={`flex items-center h-14 border-b border-sidebar-border shrink-0 ${
          collapsed ? 'justify-center px-2' : 'px-4 gap-2'
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

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-hide">
        {navigation.map((item) => renderItem(item))}
      </nav>
    </aside>
  )
}
