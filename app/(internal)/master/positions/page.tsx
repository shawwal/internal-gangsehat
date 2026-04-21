'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal'

export default function PositionsPage() {
  const { t } = useTranslation()
  return <BlankPage title={t('page.master.positions_title')} breadcrumb={t('nav.master_data')} />
}
