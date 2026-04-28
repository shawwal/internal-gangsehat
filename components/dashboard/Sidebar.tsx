'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import * as Icons from 'lucide-react'
import { navForRole } from '@/config/navigation'
import type { UserRole } from '@/types'

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LucideIcon = (Icons as any)[name]
  if (!LucideIcon) return null
  return <LucideIcon size={size} />
}

interface Props {
  role: UserRole
  collapsed: boolean
}

export function Sidebar({ role, collapsed }: Props) {
  const pathname = usePathname()
  const items = navForRole(role)

  function isActive(href?: string) {
    if (!href) return false
    return pathname === href || pathname.startsWith(href + '/')
  }

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

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-hide">
        {items.map((item) => {
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
