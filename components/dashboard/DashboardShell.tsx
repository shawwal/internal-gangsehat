'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { BottomTabBar } from './BottomTabBar'
import { NavDrawer } from './NavDrawer'
import { LocaleProvider } from '@/context/LocaleContext'
import { ToastProvider } from '@/context/ToastContext'
import type { UserRole } from '@/types'

interface Props {
  profile: {
    id: string
    full_name: string
    email: string
    role: UserRole
    branch_id: string | null
    avatar_url: string | null
  }
  allowedNavKeys: string[]
  children: React.ReactNode
}

export function DashboardShell({ profile, allowedNavKeys, children }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <LocaleProvider>
    <ToastProvider>
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar role={profile.role} branchId={profile.branch_id} allowedNavKeys={allowedNavKeys} collapsed={collapsed} />
      </div>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          fullName={profile.full_name}
          email={profile.email}
          avatarUrl={profile.avatar_url}
          onToggleSidebar={() => setCollapsed((c) => !c)}
        />
        {/* Extra bottom padding on mobile so content isn't hidden under the floating
            tab bar — the pill is ~66px tall plus mb-4 plus iOS's safe-area-inset-bottom
            (up to ~34px on Face ID devices), so pb-28 (112px) ran a few px short on
            Safari and let the last card peek out from behind it. pb-36 (144px) clears
            that with margin. */}
        <main className="flex-1 overflow-y-auto p-6 pb-36 md:pb-6 bg-background">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <BottomTabBar role={profile.role} branchId={profile.branch_id} allowedNavKeys={allowedNavKeys} onMorePress={() => setDrawerOpen(true)} />

      {/* Mobile full-menu drawer */}
      <NavDrawer role={profile.role} branchId={profile.branch_id} allowedNavKeys={allowedNavKeys} isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
    </ToastProvider>
    </LocaleProvider>
  )
}
