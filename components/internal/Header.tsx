'use client'

import { Menu } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import type { Locale } from '@/locales'

interface Props {
  onToggleSidebar: () => void
}

export function Header({ onToggleSidebar }: Props) {
  const { t, locale, setLocale } = useTranslation()
  const { user, signOut } = useAuth()
  const router = useRouter()

  async function handleLogout() {
    await signOut()
    router.push('/login')
  }

  function toggleLocale() {
    setLocale((locale === 'id' ? 'en' : 'id') as Locale)
  }

  return (
    <header
      className="h-14 flex items-center justify-between px-4 border-b border-gray-100 shrink-0"
      style={{ backgroundColor: '#FFFFFF' }}
    >
      <button
        onClick={onToggleSidebar}
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleLocale}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
        >
          {locale === 'id' ? 'EN' : 'ID'}
        </button>

        <div className="relative group">
          <button className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
            <div className="w-7 h-7 rounded-full bg-[#D4A017] flex items-center justify-center text-white text-xs font-bold">
              {user?.email?.charAt(0).toUpperCase() ?? 'U'}
            </div>
          </button>
          <div className="absolute right-0 top-8 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 hidden group-hover:block z-50">
            <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100 truncate">
              {user?.email}
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              {t('auth.logout')}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
