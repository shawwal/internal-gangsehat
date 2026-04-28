'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar role={profile.role} collapsed={collapsed} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          fullName={profile.full_name}
          email={profile.email}
          avatarUrl={profile.avatar_url}
          onToggleSidebar={() => setCollapsed((c) => !c)}
        />
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
