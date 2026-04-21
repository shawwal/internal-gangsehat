'use client'

import { useEffect, useRef, useState } from 'react'
import { Menu, Sun, Moon } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/context/ThemeContext'
import { useRouter } from 'next/navigation'
import type { Locale } from '@/locales'

interface Props {
  onToggleSidebar: () => void
}

export function Header({ onToggleSidebar }: Props) {
  const { t, locale, setLocale } = useTranslation()
  const { user, signOut } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    setMenuOpen(false)
    await signOut()
    router.push('/login')
  }

  function toggleLocale() {
    setLocale((locale === 'id' ? 'en' : 'id') as Locale)
  }

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-card shrink-0">
      <button
        onClick={onToggleSidebar}
        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleLocale}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
        >
          {locale === 'id' ? 'EN' : 'ID'}
        </button>

        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 text-sm text-foreground hover:text-foreground/80"
          >
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
              {user?.email?.charAt(0).toUpperCase() ?? 'U'}
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-9 w-44 bg-popover rounded-xl shadow-lg border border-border py-1 z-50">
              <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border truncate">
                {user?.email}
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"
              >
                {t('auth.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
