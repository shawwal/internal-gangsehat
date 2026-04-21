'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal'

export default function LeavePage() {
  const { t } = useTranslation()
  return <BlankPage title={t('page.leave.title')} />
}
