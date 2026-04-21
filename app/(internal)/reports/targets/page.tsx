'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal'

export default function TargetReportPage() {
  const { t } = useTranslation()
  return <BlankPage title={t('page.reports.targets_title')} breadcrumb={t('nav.reports')} />
}
