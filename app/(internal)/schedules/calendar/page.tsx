'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal'

export default function ScheduleCalendarPage() {
  const { t } = useTranslation()
  return <BlankPage title={t('page.schedule.calendar_title')} breadcrumb={t('nav.schedule')} />
}
