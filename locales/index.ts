import en from './en'
import id from './id'
import type { Translations } from './en'

export type Locale = 'en' | 'id'
export const supportedLocales: Locale[] = ['en', 'id']
export const defaultLocale: Locale = 'id'

const translations: Record<Locale, Translations> = { en, id }

export function getTranslations(locale: Locale): Translations {
  return translations[locale] ?? translations[defaultLocale]
}

export type { Translations }
