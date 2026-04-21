'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal'

export default function ReferencesPage() {
  const { t } = useTranslation()
  return <BlankPage title={t('page.settings.references_title')} breadcrumb={t('nav.settings')} />
}
