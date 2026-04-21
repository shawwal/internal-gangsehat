'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as LucideIcons from 'lucide-react'
import { navigation } from '@/config/navigation'
import { useTranslation } from '@/hooks/useTranslation'
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
  const { t } = useTranslation()
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
            } hover:bg-white/10 text-[#F5ECD7]/80 hover:text-[#F5ECD7]`}
          >
            <span className="shrink-0"><Icon name={item.icon} /></span>
            {!collapsed && (
              <>
                <span className="flex-1 text-sm font-medium">{t(item.key)}</span>
                <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={14} />
              </>
            )}
          </button>
          {!collapsed && open && (
            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
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
            ? 'bg-[#D4A017] text-white'
            : 'text-[#F5ECD7]/80 hover:bg-white/10 hover:text-[#F5ECD7]'
        }`}
      >
        <span className="shrink-0"><Icon name={item.icon} /></span>
        {!collapsed && <span className="text-sm font-medium">{t(item.key)}</span>}
      </Link>
    )
  }

  return (
    <aside
      style={{ backgroundColor: '#3D2B1F', color: '#F5ECD7' }}
      className={`flex flex-col h-full transition-all duration-200 ${collapsed ? 'w-16' : 'w-[220px]'}`}
    >
      <div className={`flex items-center h-14 border-b border-white/10 ${collapsed ? 'justify-center px-2' : 'px-4 gap-2'}`}>
        {!collapsed && (
          <span className="font-bold text-sm tracking-wide text-[#D4A017]" style={{ fontFamily: 'Sora, sans-serif' }}>
            TeamFGS
          </span>
        )}
        {collapsed && <Icon name="Activity" size={20} />}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navigation.map((item) => renderItem(item))}
      </nav>
    </aside>
  )
}
