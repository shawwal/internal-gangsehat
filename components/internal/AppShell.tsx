'use client'

import { useState } from 'react'
import { LocaleProvider } from '@/context/LocaleContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <ThemeProvider>
      <LocaleProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar collapsed={collapsed} />
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <Header onToggleSidebar={() => setCollapsed((c) => !c)} />
            <main className="flex-1 overflow-y-auto p-6 bg-background">
              {children}
            </main>
          </div>
        </div>
      </LocaleProvider>
    </ThemeProvider>
  )
}
