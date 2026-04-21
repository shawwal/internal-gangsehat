'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal'

export default function ServicesPage() {
  const { t } = useTranslation()
  return <BlankPage title={t('page.master.services_title')} breadcrumb={t('nav.master_data')} />
}
