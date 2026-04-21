'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal'

export default function RolesPage() {
  const { t } = useTranslation()
  return <BlankPage title={t('page.settings.roles_title')} breadcrumb={t('nav.settings')} />
}
