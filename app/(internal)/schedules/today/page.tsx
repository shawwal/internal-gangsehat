'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal'

export default function ScheduleTodayPage() {
  const { t } = useTranslation()
  return <BlankPage title={t('page.schedule.today_title')} breadcrumb={t('nav.schedule')} />
}
