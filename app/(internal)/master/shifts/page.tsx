'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal'

export default function ShiftsPage() {
  const { t } = useTranslation()
  return <BlankPage title={t('page.master.shifts_title')} breadcrumb={t('nav.master_data')} />
}
