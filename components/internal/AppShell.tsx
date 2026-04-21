'use client'

import { useState } from 'react'
import { LocaleProvider } from '@/context/LocaleContext'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <LocaleProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar collapsed={collapsed} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header onToggleSidebar={() => setCollapsed((c) => !c)} />
          <main className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: '#F4F5F7' }}>
            {children}
          </main>
        </div>
      </div>
    </LocaleProvider>
  )
}
