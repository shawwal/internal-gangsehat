'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal'

export default function TesterPage() {
  const { t } = useTranslation()
  return <BlankPage title={t('page.master.tester_title')} breadcrumb={t('nav.master_data')} />
}
