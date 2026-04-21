'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { getTranslations, defaultLocale } from '@/locales'
import type { Locale, Translations } from '@/locales'

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

const STORAGE_KEY = 'teamfgs_locale'

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)
  const [translations, setTranslations] = useState<Translations>(
    getTranslations(defaultLocale)
  )

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
    if (stored === 'en' || stored === 'id') {
      setLocaleState(stored)
      setTranslations(getTranslations(stored))
    }
  }, [])

  function setLocale(newLocale: Locale) {
    setLocaleState(newLocale)
    setTranslations(getTranslations(newLocale))
    localStorage.setItem(STORAGE_KEY, newLocale)
  }

  function t(key: string): string {
    const parts = key.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = translations
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return key
      current = current[part]
    }
    return typeof current === 'string' ? current : key
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used inside <LocaleProvider>')
  return ctx
}
