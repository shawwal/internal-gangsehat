'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal'

export default function MasterSchedulesPage() {
  const { t } = useTranslation()
  return <BlankPage title={t('page.master.schedule_title')} breadcrumb={t('nav.master_data')} />
}
