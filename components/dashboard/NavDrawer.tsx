'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import * as Icons from 'lucide-react'
import { X } from 'lucide-react'
import { navForRole } from '@/config/navigation'
import type { UserRole } from '@/types'

function NavIcon({ name, className }: { name: string; className?: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LucideIcon = (Icons as any)[name]
  if (!LucideIcon) return null
  return <LucideIcon size={20} strokeWidth={2} className={className} />
}

// Gradient per icon group so the drawer has visual interest
const ICON_GRADIENTS: Record<string, string> = {
  LayoutDashboard: 'from-blue-400 to-blue-600',
  Building2:       'from-purple-400 to-purple-600',
  FileCheck:       'from-teal-400 to-teal-600',
  FileText:        'from-teal-400 to-teal-600',
  Users:           'from-indigo-400 to-indigo-600',
  UserCog:         'from-violet-400 to-violet-600',
  CalendarOff:     'from-orange-400 to-orange-600',
  CalendarCheck:   'from-green-400 to-green-600',
  Target:          'from-pink-400 to-rose-600',
  Receipt:         'from-emerald-400 to-emerald-600',
  Megaphone:       'from-yellow-400 to-amber-500',
  HeartPulse:      'from-red-400 to-rose-500',
  Bell:            'from-sky-400 to-sky-600',
  Settings:        'from-gray-400 to-gray-600',
}

function gradientFor(icon: string) {
  return ICON_GRADIENTS[icon] ?? 'from-primary to-primary/70'
}

interface Props {
  role: UserRole
  isOpen: boolean
  onClose: () => void
}

export function NavDrawer({ role, isOpen, onClose }: Props) {
  const pathname = usePathname()
  const [isDark, setIsDark] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  // Detect dark mode
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  // Close on route change
  useEffect(() => { onClose() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trap body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const items = navForRole(role)

  const sheetBg = isDark
    ? 'rgba(10, 14, 28, 0.88)'
    : 'rgba(255, 255, 255, 0.88)'
  const sheetBorder = isDark
    ? '1px solid rgba(255,255,255,0.10)'
    : '1px solid rgba(255,255,255,0.75)'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 transition-all duration-300"
        style={{
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: isOpen ? 'blur(4px)' : 'blur(0px)',
          WebkitBackdropFilter: isOpen ? 'blur(4px)' : 'blur(0px)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      />

      {/* Bottom sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out"
        style={{
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          willChange: 'transform',
        }}
      >
        <div
          className="rounded-t-[2rem] overflow-hidden"
          style={{
            background: sheetBg,
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            borderTop: sheetBorder,
            borderLeft: sheetBorder,
            borderRight: sheetBorder,
            boxShadow: '0 -8px 60px rgba(0,0,0,0.22)',
          }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div
              className="w-9 h-1 rounded-full"
              style={{ background: isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.15)' }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3">
            <span
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.40)' }}
            >
              Menu
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full transition-colors"
              style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
              aria-label="Tutup menu"
            >
              <X size={15} style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.50)' }} />
            </button>
          </div>

          {/* Nav grid */}
          <div className="grid grid-cols-3 gap-2.5 px-4 pb-4">
            {items.map((item) => {
              const isParent = item.href
                ? items.some(i => i.href && i.href !== item.href && i.href.startsWith(item.href + '/'))
                : false
              const isActive = item.href
                ? (item.href === '/' ? pathname === '/' : isParent ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/'))
                : false

              return (
                <Link
                  key={item.key}
                  href={item.href!}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl transition-all active:scale-95"
                  style={{
                    background: isActive
                      ? isDark ? 'rgba(255,0,144,0.12)' : 'rgba(255,0,144,0.08)'
                      : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    ...(isActive ? { ring: '2px solid rgba(255,0,144,0.30)' } : {}),
                  }}
                >
                  <div
                    className={`p-2.5 rounded-xl bg-gradient-to-br ${gradientFor(item.icon)} shadow-md`}
                  >
                    <NavIcon name={item.icon} className="text-white" />
                  </div>
                  <span
                    className="text-[11px] font-medium text-center leading-tight"
                    style={{
                      color: isActive
                        ? '#FF0090'
                        : isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)',
                    }}
                  >
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>

          {/* Safe area spacer */}
          <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)', minHeight: 8 }} />
        </div>
      </div>
    </>
  )
}
