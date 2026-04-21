'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal'

export default function ConfigurationPage() {
  const { t } = useTranslation()
  return <BlankPage title={t('page.settings.configuration_title')} breadcrumb={t('nav.settings')} />
}
