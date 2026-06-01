'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import * as Icons from 'lucide-react'
import { LayoutGrid } from 'lucide-react'
import { navForRole } from '@/config/navigation'
import type { UserRole } from '@/types'

function NavIcon({ name }: { name: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LucideIcon = (Icons as any)[name]
  if (!LucideIcon) return null
  return <LucideIcon size={22} strokeWidth={1.8} />
}

interface Props {
  role: UserRole
  onMorePress: () => void
}

export function BottomTabBar({ role, onMorePress }: Props) {
  const pathname = usePathname()
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const allItems = navForRole(role)
  const tabs = allItems.slice(0, 4)

  function isActive(href?: string) {
    if (!href) return false
    if (href === '/') return pathname === '/'
    // If another nav item starts with this href + '/', it's a parent route — exact match only.
    const isParent = allItems.some(i => i.href && i.href !== href && i.href.startsWith(href + '/'))
    if (isParent) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  const pillBg = isDark
    ? 'rgba(10, 15, 30, 0.78)'
    : 'rgba(255, 255, 255, 0.78)'
  const pillBorder = isDark
    ? '1px solid rgba(255,255,255,0.12)'
    : '1px solid rgba(255,255,255,0.9)'
  const pillShadow = isDark
    ? '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)'
    : '0 8px 40px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.95)'

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden pointer-events-none">
      <div
        className="mx-3 mb-4 pointer-events-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div
          className="flex items-center justify-around px-1 py-1.5 rounded-[2rem]"
          style={{
            background: pillBg,
            backdropFilter: 'blur(40px) saturate(200%)',
            WebkitBackdropFilter: 'blur(40px) saturate(200%)',
            border: pillBorder,
            boxShadow: pillShadow,
          }}
        >
          {tabs.map((tab) => {
            const active = isActive(tab.href)
            return (
              <Link
                key={tab.key}
                href={tab.href!}
                className="relative flex flex-col items-center gap-1 px-3 py-2 rounded-[1.5rem] min-w-[60px] transition-all duration-150 active:scale-90"
              >
                {/* Active pill bubble */}
                {active && (
                  <span
                    className="absolute inset-0 rounded-[1.5rem]"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,0,144,0.14), rgba(255,0,144,0.22))',
                      border: '1px solid rgba(255,0,144,0.28)',
                      boxShadow: '0 2px 12px rgba(255,0,144,0.18)',
                    }}
                  />
                )}

                {/* Icon */}
                <span
                  className={`relative z-10 transition-all duration-200 ${active ? 'scale-110 -translate-y-px' : ''}`}
                  style={{ color: active ? '#FF0090' : isDark ? '#6b7280' : '#9ca3af' }}
                >
                  <NavIcon name={tab.icon} />
                </span>

                {/* Label */}
                <span
                  className="text-[10px] font-semibold relative z-10 leading-none truncate max-w-[56px] text-center transition-all duration-200"
                  style={{
                    color: active ? '#FF0090' : isDark ? '#6b7280' : '#9ca3af',
                    opacity: active ? 1 : 0.65,
                  }}
                >
                  {tab.label}
                </span>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={onMorePress}
            className="relative flex flex-col items-center gap-1 px-3 py-2 rounded-[1.5rem] min-w-[60px] transition-all duration-150 active:scale-90"
          >
            <span style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
              <LayoutGrid size={22} strokeWidth={1.8} />
            </span>
            <span
              className="text-[10px] font-semibold leading-none"
              style={{ color: isDark ? '#6b7280' : '#9ca3af', opacity: 0.65 }}
            >
              Lainnya
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
