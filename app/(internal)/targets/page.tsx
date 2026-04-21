'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal'

export default function TargetsPage() {
  const { t } = useTranslation()
  return <BlankPage title={t('page.targets.title')} />
}
