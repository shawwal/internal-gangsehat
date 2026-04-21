'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { PageHeader } from '@/components/internal'

export default function DashboardPage() {
  const { t } = useTranslation()

  return (
    <div>
      <PageHeader title={t('page.dashboard.title')} />
      <div className="rounded-2xl bg-white border border-gray-100 p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-2" style={{ fontFamily: 'Sora, sans-serif' }}>
          {t('app.welcome_title')} 👋
        </h2>
        <p className="text-gray-500 text-sm max-w-lg">{t('app.welcome_message')}</p>
        <p className="text-gray-400 text-xs mt-3">{t('app.welcome_sub')}</p>
      </div>
    </div>
  )
}
