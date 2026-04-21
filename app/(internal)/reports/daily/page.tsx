'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal'

export default function DailyReportPage() {
  const { t } = useTranslation()
  return <BlankPage title={t('page.reports.daily_title')} breadcrumb={t('nav.reports')} />
}
