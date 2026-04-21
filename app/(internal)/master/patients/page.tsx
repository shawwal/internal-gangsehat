'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal'

export default function PatientsPage() {
  const { t } = useTranslation()
  return <BlankPage title={t('page.master.patients_title')} breadcrumb={t('nav.master_data')} />
}
