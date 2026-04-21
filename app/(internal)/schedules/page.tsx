'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal'

export default function SchedulesPage() {
  const { t } = useTranslation()
  return <BlankPage title={t('page.schedule.list_title')} breadcrumb={t('nav.schedule')} />
}
