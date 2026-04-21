'use client'

import { PageHeader } from './PageHeader'
import { useTranslation } from '@/hooks/useTranslation'

interface Props {
  title: string
  breadcrumb?: string
  actions?: React.ReactNode
}

export function BlankPage({ title, breadcrumb, actions }: Props) {
  const { t } = useTranslation()

  return (
    <div>
      <PageHeader title={title} breadcrumb={breadcrumb} actions={actions} />
      <div className="rounded-2xl bg-white border border-gray-100 p-12 flex flex-col items-center justify-center text-center gap-3 min-h-[300px]">
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
          <span className="text-2xl">🚧</span>
        </div>
        <p className="text-gray-500 text-sm max-w-sm">{t('common.coming_soon')}</p>
      </div>
    </div>
  )
}
