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
  children: React.ReactNode
}

export function DashboardShell({ profile, children }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <LocaleProvider>
    <ToastProvider>
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar role={profile.role} collapsed={collapsed} />
      </div>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          fullName={profile.full_name}
          email={profile.email}
          avatarUrl={profile.avatar_url}
          onToggleSidebar={() => setCollapsed((c) => !c)}
        />
        {/* Extra bottom padding on mobile so content isn't hidden under the tab bar */}
        <main className="flex-1 overflow-y-auto p-6 pb-28 md:pb-6 bg-background">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <BottomTabBar role={profile.role} onMorePress={() => setDrawerOpen(true)} />

      {/* Mobile full-menu drawer */}
      <NavDrawer role={profile.role} isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
    </ToastProvider>
    </LocaleProvider>
  )
}
