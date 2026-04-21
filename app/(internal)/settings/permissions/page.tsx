'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal'

export default function PermissionsPage() {
  const { t } = useTranslation()
  return <BlankPage title={t('page.settings.permissions_title')} breadcrumb={t('nav.settings')} />
}
