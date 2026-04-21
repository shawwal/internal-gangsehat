'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal'

export default function TerritoriesPage() {
  const { t } = useTranslation()
  return <BlankPage title={t('page.master.territory_title')} breadcrumb={t('nav.master_data')} />
}
