'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal'

export default function ReportsPage() {
  const { t } = useTranslation()
  return <BlankPage title={t('page.reports.statistics_title')} breadcrumb={t('nav.reports')} />
}
